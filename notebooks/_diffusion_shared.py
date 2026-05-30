"""diffusion 軌道共用素材：手刻 DDPM 的模型/排程 + diffusers 安裝字串。

手刻部分（L02–L04）在 MNIST 上做一個迷你擴散模型，理念同 llm 軌道：
**功能不求強,重在徹底理解加噪/去噪機制。** diffusers 部分（L06–L08）用
Stable Diffusion（sd-turbo,快又免 gating）。全軌道 **無輸出提交**,留 Colab T4 跑。
"""

# 安裝字串
INSTALL_TORCH = '%pip install -q -U torchvision'
INSTALL_DIFFUSERS = '%pip install -q -U diffusers transformers accelerate'
INSTALL_CLIP = '%pip install -q -U transformers'

# 迷你 U-Net：吃 (x_t, t)、預測加進去的噪聲。為 MNIST(縮到 32×32)設計。
UNET_SRC = '''
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class SinusoidalPosEmb(nn.Module):
    """把整數時間步 t 編碼成向量(同 Transformer 的位置編碼)。"""

    def __init__(self, dim):
        super().__init__()
        self.dim = dim

    def forward(self, t):
        half = self.dim // 2
        freqs = torch.exp(
            -math.log(10000) * torch.arange(half, device=t.device) / (half - 1)
        )
        args = t[:, None].float() * freqs[None]
        return torch.cat([args.sin(), args.cos()], dim=-1)


class ResBlock(nn.Module):
    """conv 殘差塊,並把時間嵌入加進特徵圖。"""

    def __init__(self, cin, cout, tdim):
        super().__init__()
        self.norm1 = nn.GroupNorm(8, cin)
        self.conv1 = nn.Conv2d(cin, cout, 3, padding=1)
        self.temb = nn.Linear(tdim, cout)
        self.norm2 = nn.GroupNorm(8, cout)
        self.conv2 = nn.Conv2d(cout, cout, 3, padding=1)
        self.skip = nn.Conv2d(cin, cout, 1) if cin != cout else nn.Identity()

    def forward(self, x, temb):
        h = self.conv1(F.silu(self.norm1(x)))
        h = h + self.temb(temb)[:, :, None, None]
        h = self.conv2(F.silu(self.norm2(h)))
        return h + self.skip(x)


class TinyUNet(nn.Module):
    """最小可用的 U-Net:下採樣兩次、上採樣兩次,帶 skip 連接。"""

    def __init__(self, base=32, tdim=128):
        super().__init__()
        self.time_mlp = nn.Sequential(
            SinusoidalPosEmb(tdim), nn.Linear(tdim, tdim), nn.SiLU(), nn.Linear(tdim, tdim)
        )
        self.in_conv = nn.Conv2d(1, base, 3, padding=1)
        self.d1 = ResBlock(base, base, tdim)
        self.down1 = nn.Conv2d(base, base, 4, 2, 1)
        self.d2 = ResBlock(base, base * 2, tdim)
        self.down2 = nn.Conv2d(base * 2, base * 2, 4, 2, 1)
        self.mid = ResBlock(base * 2, base * 2, tdim)
        self.up2 = nn.ConvTranspose2d(base * 2, base * 2, 4, 2, 1)
        self.u2 = ResBlock(base * 2 + base * 2, base, tdim)
        self.up1 = nn.ConvTranspose2d(base, base, 4, 2, 1)
        self.u1 = ResBlock(base + base, base, tdim)
        self.out = nn.Sequential(nn.GroupNorm(8, base), nn.SiLU(), nn.Conv2d(base, 1, 3, padding=1))

    def forward(self, x, t):
        temb = self.time_mlp(t)
        x = self.in_conv(x)
        s1 = self.d1(x, temb)
        x = self.down1(s1)
        s2 = self.d2(x, temb)
        x = self.down2(s2)
        x = self.mid(x, temb)
        x = self.up2(x)
        x = self.u2(torch.cat([x, s2], dim=1), temb)
        x = self.up1(x)
        x = self.u1(torch.cat([x, s1], dim=1), temb)
        return self.out(x)
'''

# DDPM 排程 + 前向加噪 + 兩種取樣(DDPM / DDIM)。假設外面已定義 device。
DDPM_SRC = '''
import torch

T = 200                                                  # 擴散步數
betas = torch.linspace(1e-4, 0.02, T, device=device)     # 線性 beta 排程
alphas = 1.0 - betas
alphabars = torch.cumprod(alphas, dim=0)                  # 連乘:一步到位的關鍵


def q_sample(x0, t, noise):
    """前向加噪(closed form):x_t = sqrt(ab)·x0 + sqrt(1-ab)·noise。"""
    ab = alphabars[t].view(-1, 1, 1, 1)
    return ab.sqrt() * x0 + (1 - ab).sqrt() * noise


@torch.no_grad()
def ddpm_sample(model, n=16):
    """反向去噪:從純噪聲一步步還原,共 T 步(慢但標準)。"""
    model.eval()
    x = torch.randn(n, 1, 32, 32, device=device)
    for i in reversed(range(T)):
        t = torch.full((n,), i, device=device, dtype=torch.long)
        eps = model(x, t)
        a, ab, beta = alphas[i], alphabars[i], betas[i]
        mean = (x - (1 - a) / (1 - ab).sqrt() * eps) / a.sqrt()
        x = mean + beta.sqrt() * torch.randn_like(x) if i > 0 else mean
    return x


@torch.no_grad()
def ddim_sample(model, n=16, steps=20):
    """DDIM:確定性取樣,跳著走、只要 steps 步(快很多)。"""
    model.eval()
    x = torch.randn(n, 1, 32, 32, device=device)
    seq = torch.linspace(T - 1, 0, steps, device=device).long().tolist()
    for j, i in enumerate(seq):
        t = torch.full((n,), i, device=device, dtype=torch.long)
        eps = model(x, t)
        ab = alphabars[i]
        x0 = (x - (1 - ab).sqrt() * eps) / ab.sqrt()         # 預測乾淨影像
        if j < len(seq) - 1:
            ab_next = alphabars[seq[j + 1]]
            x = ab_next.sqrt() * x0 + (1 - ab_next).sqrt() * eps
        else:
            x = x0
    return x
'''

# 載入 MNIST,縮到 32×32、正規化到 [-1,1]（擴散模型慣例）。
DATA_SRC = '''
import torch
import torchvision
from torchvision import transforms
from torch.utils.data import DataLoader

tf = transforms.Compose([
    transforms.Resize(32),
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,)),     # → [-1, 1]
])
mnist = torchvision.datasets.MNIST("./data", train=True, download=True, transform=tf)
loader = DataLoader(mnist, batch_size=128, shuffle=True, num_workers=2)
print(f"MNIST {len(mnist)} 張,縮到 32×32、正規化到 [-1,1]")
'''

# 訓練迴圈:隨機抽時間步、加噪、要模型把噪聲預測回來。
TRAIN_SRC = '''
import torch
import torch.nn.functional as F


def train_diffusion(model, loader, epochs=5, lr=2e-4):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    for ep in range(1, epochs + 1):
        model.train()
        total, nb = 0.0, 0
        for x, _ in loader:
            x = x.to(device)
            t = torch.randint(0, T, (x.size(0),), device=device)
            noise = torch.randn_like(x)
            pred = model(q_sample(x, t, noise), t)        # 預測加進去的噪聲
            loss = F.mse_loss(pred, noise)
            opt.zero_grad(); loss.backward(); opt.step()
            total += loss.item(); nb += 1
        print(f"epoch {ep}/{epochs}  loss {total / nb:.4f}")
    return model
'''

# 把一批 [-1,1] 的影像畫成 grid。
SHOWGEN_SRC = '''
import matplotlib.pyplot as plt


def show_gen(imgs, cols=8, title=None):
    imgs = ((imgs.clamp(-1, 1) + 1) / 2).detach().cpu()    # [-1,1] → [0,1]
    n = len(imgs); rows = (n + cols - 1) // cols
    plt.figure(figsize=(cols * 1.1, rows * 1.15))
    for i in range(n):
        ax = plt.subplot(rows, cols, i + 1)
        ax.imshow(imgs[i, 0], cmap="gray"); ax.axis("off")
    if title:
        plt.suptitle(title)
    plt.tight_layout(); plt.show()
'''
