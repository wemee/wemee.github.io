"""產生 diffusion 軌道 lessons 01–04 的 notebook（手刻迷你擴散模型）。

用法：
    notebooks/.venv/bin/python notebooks/gen_diffusion_1to4.py

比照其他軌道：**無輸出提交**，留 Colab T4 跑（訓練吃 GPU）。
理念同 llm 軌道:功能不求強,重在徹底理解加噪/去噪機制。
"""

from _diffusion_shared import (
    DATA_SRC,
    DDPM_SRC,
    INSTALL_TORCH,
    SHOWGEN_SRC,
    TRAIN_SRC,
    UNET_SRC,
)
from _nbgen import build_notebook, code, md

DIR = "diffusion/from-scratch"

DEVICE_SRC = '''
import torch
device = "cuda" if torch.cuda.is_available() else "cpu"
print("device:", device)
'''


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 生成模型的世界觀：從加噪到去噪

歡迎來到 **生成式影像 → 擴散模型生成影像**。

前面的軌道讓模型**辨識**影像(分類、偵測)。這條軌道反過來:讓模型**創造**影像。能無中生有畫出一張圖的模型,叫**生成模型**。

## 三條路線的直覺

- **VAE**:學會把圖壓成一個小向量、再還原。生成 = 從向量空間取一點解碼。圖通常偏糊。
- **GAN**:一個「畫家」和一個「鑑定師」對抗訓練。圖很銳利,但訓練不穩、容易崩。
- **Diffusion(擴散)**:今天的主流(Stable Diffusion、Midjourney、DALL·E 都是)。點子優雅到不可思議——

> **先學會「把圖一步步加噪變成雪花」,再反過來「從雪花一步步去噪還原成圖」。** 會去噪,就會生成:餵一張純噪聲進去,反覆去噪,就「長」出一張全新的圖。

## 這堂課你會學到

- 三種生成模型(VAE / GAN / Diffusion)的核心直覺與取捨
- **親眼看擴散的「前向過程」**:把一張 MNIST 數字一步步加噪,直到變成純雪花
- 建立「**破壞是為了學會重建**」的心智模型——整條軌道的靈魂
"""
        ),
        md("## 1. 安裝與設定"),
        code(INSTALL_TORCH),
        code(DEVICE_SRC),
        md("## 2. 拿一張 MNIST 數字"),
        code(
            '''
import torchvision
from torchvision import transforms
import matplotlib.pyplot as plt

tf = transforms.Compose([transforms.Resize(32), transforms.ToTensor(),
                         transforms.Normalize((0.5,), (0.5,))])
mnist = torchvision.datasets.MNIST("./data", train=True, download=True, transform=tf)
x0, label = mnist[1]
print("一張數字,形狀", tuple(x0.shape), " 標籤", label)
plt.imshow(((x0[0] + 1) / 2), cmap="gray"); plt.axis("off"); plt.show()
'''
        ),
        md(
            "## 3. 前向過程:一步步把它加噪成雪花\n\n"
            "每一步混入一點高斯噪聲。看著數字慢慢溶解——擴散模型要學的,就是**反過來走這條路**。"
        ),
        code(
            '''
import torch

steps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]      # 噪聲比例
fig, axes = plt.subplots(1, len(steps), figsize=(11, 2.2))
noise = torch.randn_like(x0)
for ax, s in zip(axes, steps):
    noisy = (1 - s) * x0 + s * noise          # 簡化示意:線性混入噪聲
    ax.imshow(((noisy[0].clamp(-1, 1) + 1) / 2), cmap="gray")
    ax.set_title(f"noise={s:.1f}", fontsize=10); ax.axis("off")
plt.tight_layout(); plt.show()
'''
        ),
        md(
            """
## 小結

- **生成模型讓 AI 創造而非辨識**。三大家族:VAE(糊但穩)、GAN(銳利但難訓)、Diffusion(現今主流)。
- 擴散的核心:**前向加噪**(圖 → 雪花)是固定的、不用學;要學的是**反向去噪**(雪花 → 圖)。
- 會去噪 → 餵純噪聲反覆去噪 → 生出全新的圖。

下一課:把這個「加噪」過程**寫成正式的數學排程**(forward diffusion)。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-worldview.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 手刻 Forward Diffusion：加噪的數學

上一課的「線性混入噪聲」只是示意。真正的擴散模型用一套精心設計的**加噪排程**,而且有個漂亮的性質:**任何一步 `x_t` 都能從原圖 `x_0` 一步算出來**,不必真的跑 t 次迴圈。

## 核心公式

> 定義每步的噪聲量 `β_t`,令 `α_t = 1 − β_t`、`ᾱ_t = α_1·α_2···α_t`(連乘)。則:
>
> **x_t = √ᾱ_t · x_0 + √(1−ᾱ_t) · ε** ,其中 ε 是標準高斯噪聲。
>
> t 越大,`ᾱ_t` 越接近 0 → 原圖成分越少、噪聲越多,最後變純雪花。

這個 closed form 是訓練能高效進行的關鍵:隨機挑一個 t,一步就生出對應的 `x_t`。
"""
        ),
        md("## 1. 設定"),
        code(INSTALL_TORCH),
        code(DEVICE_SRC),
        md("## 2. 建立 beta 排程與 `q_sample`\n\n`alphabars` 就是上面的 ᾱ;`q_sample` 實作那條 closed-form 公式。"),
        code(DDPM_SRC),
        code(
            '''
print("擴散步數 T =", T)
print("ᾱ 第一步 =", round(alphabars[0].item(), 4), " 最後一步 =", round(alphabars[-1].item(), 6))
print("→ ᾱ 從接近 1 一路降到接近 0:原圖成分越來越少。")
'''
        ),
        md("## 3. 用公式直接生出不同 t 的加噪圖\n\n注意:每張都是**一步算出**的,沒有跑迴圈。"),
        code(
            '''
import torch
import torchvision
from torchvision import transforms
import matplotlib.pyplot as plt

tf = transforms.Compose([transforms.Resize(32), transforms.ToTensor(),
                         transforms.Normalize((0.5,), (0.5,))])
x0 = torchvision.datasets.MNIST("./data", train=True, download=True, transform=tf)[1][0]
x0 = x0.unsqueeze(0).to(device)

ts = [0, 25, 50, 100, 150, 199]
fig, axes = plt.subplots(1, len(ts), figsize=(11, 2.2))
for ax, ti in zip(axes, ts):
    t = torch.tensor([ti], device=device)
    xt = q_sample(x0, t, torch.randn_like(x0))     # closed form,一步到位
    ax.imshow(((xt[0, 0].clamp(-1, 1) + 1) / 2).cpu(), cmap="gray")
    ax.set_title(f"t={ti}", fontsize=10); ax.axis("off")
plt.tight_layout(); plt.show()
'''
        ),
        md(
            """
## 小結

- **前向擴散有 closed form**:`x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε`,任一步一步算出。
- `β` 排程決定加噪速度;`ᾱ_t`(連乘)從 ~1 降到 ~0,圖逐漸變雪花。
- 這個性質讓訓練能「隨機抽一個 t、一步加噪」,不必跑完整鏈條。

下一課:訓練一個 **U-Net** 來學會「看著 x_t,把加進去的噪聲 ε 預測回來」——這就是去噪。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-forward-diffusion.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 手刻去噪 U-Net：訓練模型生成數字

整條軌道的**核心課**。前向加噪不用學;要學的是**反向去噪**。做法出奇地簡單:

> 訓練一個神經網路,**看著加噪圖 `x_t` 和時間步 `t`,把當初加進去的噪聲 `ε` 預測出來**。損失就是「預測的噪聲」和「真正的噪聲」的 MSE。

學會預測噪聲,等於學會了「這張圖該往哪個方向去噪」。我們用一個迷你 **U-Net** 來當這個去噪器。
"""
        ),
        md("## 1. 設定、模型、排程、資料"),
        code(INSTALL_TORCH),
        code(DEVICE_SRC),
        code(UNET_SRC),
        code(DDPM_SRC),
        code(DATA_SRC),
        md(
            "## 2. U-Net 去噪器\n\n"
            "**U-Net** 是影像生成的標準骨架:下採樣抓全局、上採樣回細節,中間用 skip 連接保留細節。"
            "它額外吃一個**時間步 t**(用正弦編碼),才知道現在在去噪的哪個階段。"
        ),
        code(
            '''
model = TinyUNet().to(device)
print(sum(p.numel() for p in model.parameters()), "個參數")
'''
        ),
        md(
            "## 3. 訓練:讓它學會預測噪聲\n\n"
            "每一步:隨機抽 `t` → 加噪得 `x_t` → 模型預測噪聲 → 跟真噪聲算 MSE。"
            "MNIST 上幾個 epoch(T4 幾分鐘)就能生出像樣的數字。**功能不求強,重在跑通機制。**"
        ),
        code(TRAIN_SRC),
        code('model = train_diffusion(model, loader, epochs=5)'),
        md("## 4. 生成!從純噪聲反向去噪\n\n餵一批純雪花,跑完整個反向過程,看數字「長」出來。"),
        code(SHOWGEN_SRC),
        code(
            '''
samples = ddpm_sample(model, n=16)
show_gen(samples, cols=8, title="Generated from pure noise")
'''
        ),
        md(
            """
## 小結

- **去噪 = 訓練網路預測「加進去的噪聲」**,損失是預測噪聲與真噪聲的 MSE。
- **U-Net + 時間步嵌入**是擴散模型的標準去噪器。
- 訓練好後,**餵純噪聲、反覆去噪,就生出全新數字**——這就是擴散生成的本質。
- 你的數字也許歪歪扭扭,沒關係——**重點是你親手跑通了 Stable Diffusion 的核心機制**。

下一課:加速生成——比較 **DDPM(慢)與 DDIM(快)** 兩種取樣,並看去噪的逐步軌跡。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-denoising-unet.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 取樣：DDPM vs DDIM，與去噪軌跡

上一課用 `ddpm_sample` 生成,它老老實實走完全部 T=200 步,**慢**。這課認識更快的取樣法,並把「雪花 → 數字」的過程**逐步畫出來**。

> **DDPM**:標準反向過程,每步都加一點隨機性,要走完全部 T 步。
> **DDIM**:把取樣變成**確定性**的,而且可以**跳著走**——只要 20 步就能生出差不多的圖,快 10 倍。
"""
        ),
        md("## 1. 設定、模型、排程、資料(同前)"),
        code(INSTALL_TORCH),
        code(DEVICE_SRC),
        code(UNET_SRC),
        code(DDPM_SRC),
        code(DATA_SRC),
        code(TRAIN_SRC),
        md("## 2. 快速訓練一個去噪器\n\n為了這課自成一體,先訓練幾個 epoch(同上一課)。"),
        code('model = train_diffusion(model := TinyUNet().to(device), loader, epochs=5)'),
        md("## 3. DDPM(200 步)vs DDIM(20 步)\n\n同一個模型,兩種取樣。DDIM 用十分之一的步數,品質卻接近。"),
        code(SHOWGEN_SRC),
        code(
            '''
import time

t0 = time.time(); ddpm = ddpm_sample(model, n=8); t_ddpm = time.time() - t0
t0 = time.time(); ddim = ddim_sample(model, n=8, steps=20); t_ddim = time.time() - t0
print(f"DDPM 200 步:{t_ddpm:.1f}s")
print(f"DDIM  20 步:{t_ddim:.1f}s  (快約 {t_ddpm / max(t_ddim, 1e-6):.0f} 倍)")
show_gen(ddpm, cols=8, title="DDPM (200 steps)")
show_gen(ddim, cols=8, title="DDIM (20 steps)")
'''
        ),
        md(
            "## 4. 把去噪軌跡畫出來\n\n"
            "從純噪聲到清晰數字,中間長什麼樣?抓 DDIM 過程中的幾個快照,看它一步步「顯影」。"
        ),
        code(
            '''
import torch
import matplotlib.pyplot as plt

@torch.no_grad()
def ddim_trajectory(model, steps=20, snaps=6):
    model.eval()
    x = torch.randn(1, 1, 32, 32, device=device)
    seq = torch.linspace(T - 1, 0, steps, device=device).long().tolist()
    frames = []
    for j, i in enumerate(seq):
        t = torch.full((1,), i, device=device, dtype=torch.long)
        eps = model(x, t); ab = alphabars[i]
        x0 = (x - (1 - ab).sqrt() * eps) / ab.sqrt()
        x = (alphabars[seq[j + 1]].sqrt() * x0 + (1 - alphabars[seq[j + 1]]).sqrt() * eps
             if j < len(seq) - 1 else x0)
        frames.append(x.clone())
    idx = [int(k) for k in torch.linspace(0, len(frames) - 1, snaps)]
    fig, axes = plt.subplots(1, snaps, figsize=(11, 2.2))
    for ax, k in zip(axes, idx):
        ax.imshow(((frames[k][0, 0].clamp(-1, 1) + 1) / 2).cpu(), cmap="gray")
        ax.set_title(f"step {k}", fontsize=10); ax.axis("off")
    plt.tight_layout(); plt.show()

ddim_trajectory(model)
'''
        ),
        md(
            """
## 小結

- **DDPM**(全 T 步、有隨機性)vs **DDIM**(可跳步、確定性):後者快一個量級,品質接近。
- 真實的 Stable Diffusion 也是用 DDIM 這類**少步快取樣**,你才不用等好幾分鐘。
- 去噪軌跡顯示生成是**逐步顯影**:從雪花裡慢慢「凝結」出結構。

下一課:跨入**文字條件**——怎麼讓「一句話」導引生成什麼圖(CLIP 與 text embedding)。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-sampling.ipynb")


if __name__ == "__main__":
    print("產生 diffusion lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
