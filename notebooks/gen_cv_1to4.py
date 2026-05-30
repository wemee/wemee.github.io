"""產生 cv 軌道 lessons 01–04 的 notebook（深度電腦視覺）。

用法：
    notebooks/.venv/bin/python notebooks/gen_cv_1to4.py

比照 agent/rl 軌道：**無輸出提交**，留 Colab T4 跑（訓練吃 GPU）。
build_notebook 只寫 JSON、不執行，產出天生無輸出。
"""

from _cv_shared import CIFAR_SRC, INSTALL_VISION, SHOW_SRC
from _nbgen import build_notebook, code, md

DIR = "cv/deep-vision"


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 影像即張量：torchvision 的入口

歡迎來到 **電腦視覺 → 深度電腦視覺**。

這條軌道**假設你已經學過 `ml/pytorch`**(會 tensor、autograd、訓練迴圈、CNN 基礎)。我們不重教這些,而是直接做**視覺專屬的進階主題**:遷移學習、資料增強、物件偵測、影像分割、可解釋性。

第一步,先把最根本的觀念釘牢:

> **在電腦眼裡,一張彩色影像就是一個形狀 `[C, H, W]` 的張量**——3 個顏色通道(RGB)× 高 × 寬,每個數字是一個像素強度。所有視覺模型,吃的都是這個張量。
"""
        ),
        md("## 1. 安裝 torchvision\n\ntorchvision 提供資料集、預訓練模型與影像轉換工具。"),
        code(INSTALL_VISION),
        code(CIFAR_SRC),
        md(
            "## 2. 載入 CIFAR-10,看一張影像的「形狀」\n\n"
            "CIFAR-10 是 6 萬張 32×32 的彩色小圖,分 10 類。`ToTensor()` 會把 PIL 影像"
            "轉成 `[3,32,32]` 的張量,並把像素從 0–255 縮到 **0–1**。"
        ),
        code(
            '''
import torchvision
from torchvision import transforms

train = torchvision.datasets.CIFAR10(
    root="./data", train=True, download=True, transform=transforms.ToTensor()
)
img, label = train[0]
print("一張影像的形狀:", tuple(img.shape))      # (3, 32, 32) = (通道, 高, 寬)
print("像素範圍:", round(img.min().item(), 3), "~", round(img.max().item(), 3))
print("標籤:", label, "→", CIFAR10_CLASSES[label])
'''
        ),
        md("## 3. 把一批影像畫出來\n\n用 `DataLoader` 一次拿一批,再用小工具排成 grid 看看。"),
        code(SHOW_SRC),
        code(
            '''
from torch.utils.data import DataLoader

loader = DataLoader(train, batch_size=16, shuffle=True)
imgs, labels = next(iter(loader))
print("一個 batch 的形狀:", tuple(imgs.shape))   # (16, 3, 32, 32)
show_images(imgs, labels, CIFAR10_CLASSES, cols=8)
'''
        ),
        md(
            "## 4. 正規化:模型更好訓練的關鍵前處理\n\n"
            "把每個通道減掉平均、除以標準差,讓輸入分布更集中,訓練更穩、更快。"
            "這是視覺模型幾乎必做的一步。"
        ),
        code(
            '''
import torch

norm_tf = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(CIFAR10_MEAN, CIFAR10_STD),
])
norm_train = torchvision.datasets.CIFAR10(root="./data", train=True, transform=norm_tf)
nimg, _ = norm_train[0]
print("正規化後像素範圍:", round(nimg.min().item(), 2), "~", round(nimg.max().item(), 2))
print("→ 不再是 0~1,而是以 0 為中心、有正有負")
'''
        ),
        md(
            """
## 小結

- **影像 = `[C,H,W]` 張量**:RGB 三通道 × 高 × 寬,每格一個像素值。
- `torchvision.datasets` 一行下載資料集,`transforms` 組裝前處理管線。
- `ToTensor()` 把像素縮到 0–1;`Normalize()` 再以平均/標準差置中,讓訓練更穩。

下一課:在這個彩色資料集上,訓練一個比 pytorch 軌道更實際的 **CNN**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-images-as-tensors.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 在 CIFAR-10 上訓練一個 CNN

`ml/pytorch` 軌道你在灰階的 MNIST 上跑過 CNN。這課升級到**彩色、更難**的 CIFAR-10,並用上現代 CNN 的標準配備:**Conv → BatchNorm → ReLU** 堆疊、**MaxPool** 降尺寸、**Dropout** 抗過擬合。

目標不是衝 SOTA,而是讓你看到一個「像樣的」CNN 怎麼組、怎麼在真實彩色資料上學起來。
"""
        ),
        md("## 1. 安裝與資料"),
        code(INSTALL_VISION),
        code(CIFAR_SRC),
        code(
            '''
import torch
import torchvision
from torchvision import transforms
from torch.utils.data import DataLoader

device = "cuda" if torch.cuda.is_available() else "cpu"
tf = transforms.Compose([transforms.ToTensor(),
                         transforms.Normalize(CIFAR10_MEAN, CIFAR10_STD)])
train_set = torchvision.datasets.CIFAR10("./data", train=True, download=True, transform=tf)
test_set = torchvision.datasets.CIFAR10("./data", train=False, download=True, transform=tf)
train_loader = DataLoader(train_set, batch_size=128, shuffle=True, num_workers=2)
test_loader = DataLoader(test_set, batch_size=256, num_workers=2)
print(f"訓練 {len(train_set)} 張、測試 {len(test_set)} 張，device={device}")
'''
        ),
        md(
            "## 2. 一個現代風格的小 CNN\n\n"
            "三個「卷積區塊」,每區塊兩層 conv + BatchNorm + ReLU,再 MaxPool 把尺寸減半"
            "(32→16→8→4)。最後攤平接全連接層分類。"
        ),
        code(
            '''
import torch.nn as nn


def conv_block(cin, cout):
    return nn.Sequential(
        nn.Conv2d(cin, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
        nn.Conv2d(cout, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
        nn.MaxPool2d(2),
    )


class SmallCNN(nn.Module):
    def __init__(self, n_classes=10):
        super().__init__()
        self.features = nn.Sequential(conv_block(3, 32), conv_block(32, 64), conv_block(64, 128))
        self.head = nn.Sequential(
            nn.Flatten(), nn.Linear(128 * 4 * 4, 256), nn.ReLU(inplace=True),
            nn.Dropout(0.3), nn.Linear(256, n_classes),
        )

    def forward(self, x):
        return self.head(self.features(x))


model = SmallCNN().to(device)
print(sum(p.numel() for p in model.parameters()), "個參數")
'''
        ),
        md("## 3. 訓練\n\n標準訓練迴圈。CIFAR-10 約 5–8 個 epoch 就能看到明顯成效(T4 幾分鐘)。"),
        code(
            '''
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()
EPOCHS = 6

for ep in range(1, EPOCHS + 1):
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        opt.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        opt.step()
    print(f"epoch {ep}/{EPOCHS}  最後一批 loss {loss.item():.3f}")
print("訓練完成。")
'''
        ),
        md("## 4. 評估準確率 + 看幾個預測"),
        code(
            '''
model.eval()
correct = total = 0
with torch.no_grad():
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        pred = model(x).argmax(1)
        correct += (pred == y).sum().item()
        total += y.size(0)
print(f"測試準確率:{100 * correct / total:.1f}%")
'''
        ),
        md(
            """
## 小結

- 在彩色、較難的 CIFAR-10 上,組了一個有 **BatchNorm / Dropout** 的現代小 CNN。
- 訓練幾個 epoch 就能到不錯的準確率——但純手刻 CNN 要再往上很吃資料與算力。
- 下一課的**遷移學習**會讓你用更少資料、更快達到更高準確率。

下一課:不從零訓練,改站在 ImageNet 預訓練模型的肩上。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-cnn-cifar.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 遷移學習:站在 ImageNet 的肩上

從零訓練 CNN 要大量資料與算力。**遷移學習**是電腦視覺最實用的一招:

> 拿一個在 **ImageNet**(120 萬張、1000 類)上**預訓練**好的模型,它的前面幾層已經學會了通用的視覺特徵(邊緣、紋理、形狀)。我們**凍結這些層、只換掉最後的分類頭**,用少量自己的資料微調——又快又準。

這課拿預訓練的 **ResNet-18**,改造成 CIFAR-10 的 10 類分類器。
"""
        ),
        md("## 1. 安裝與資料\n\nResNet 吃 224×224,所以把 CIFAR 的 32×32 放大,並用 ImageNet 的正規化。"),
        code(INSTALL_VISION),
        code(CIFAR_SRC),
        code(
            '''
import torch
import torchvision
from torchvision import transforms
from torch.utils.data import DataLoader

device = "cuda" if torch.cuda.is_available() else "cpu"
# ImageNet 預訓練模型慣用的尺寸與正規化
tf = transforms.Compose([
    transforms.Resize(224),
    transforms.ToTensor(),
    transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
])
train_set = torchvision.datasets.CIFAR10("./data", train=True, download=True, transform=tf)
test_set = torchvision.datasets.CIFAR10("./data", train=False, download=True, transform=tf)
train_loader = DataLoader(train_set, batch_size=128, shuffle=True, num_workers=2)
test_loader = DataLoader(test_set, batch_size=256, num_workers=2)
'''
        ),
        md(
            "## 2. 載入預訓練 ResNet-18,凍結 backbone、換新頭\n\n"
            "`requires_grad = False` 凍結原本的權重;只把最後的 `fc` 換成 10 類的新層,讓它去學。"
        ),
        code(
            '''
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights

model = resnet18(weights=ResNet18_Weights.DEFAULT)   # 載入 ImageNet 預訓練權重
for p in model.parameters():
    p.requires_grad = False                          # 凍結整個 backbone
model.fc = nn.Linear(model.fc.in_features, 10)       # 換成全新、可訓練的分類頭
model = model.to(device)
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"只需訓練 {trainable} 個參數(就是那顆新頭)")
'''
        ),
        md(
            "## 3. 只微調分類頭\n\n"
            "因為只訓練一層,**收斂超快**——通常 2–3 個 epoch 就贏過上一課從零訓練的 CNN。"
        ),
        code(
            '''
opt = torch.optim.Adam(model.fc.parameters(), lr=1e-3)   # 只更新新頭
loss_fn = nn.CrossEntropyLoss()

for ep in range(1, 4):
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        opt.zero_grad()
        loss_fn(model(x), y).backward()
        opt.step()
    print(f"epoch {ep}/3 完成")
print("微調完成。")
'''
        ),
        md("## 4. 評估"),
        code(
            '''
model.eval()
correct = total = 0
with torch.no_grad():
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        correct += (model(x).argmax(1) == y).sum().item()
        total += y.size(0)
print(f"遷移學習準確率:{100 * correct / total:.1f}%  (只訓練一層、只跑 3 個 epoch)")
'''
        ),
        md(
            """
## 小結

- **遷移學習 = 借用預訓練模型的通用視覺特徵**,只換/微調最後的分類頭。
- 凍結 backbone → 只訓練一層 → **又快又省資料**,效果還常常更好。
- 這是業界做影像分類的**預設起手式**——很少人真的從零訓練。
- 進階玩法:解凍後面幾層、用更小學習率一起微調(fine-tuning)。

下一課:用**資料增強**進一步對抗過擬合、榨出更多效能。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-transfer-learning.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 資料增強:對抗過擬合

模型在訓練集上很準、在測試集上卻爛掉——這就是**過擬合**:它把訓練圖「背」起來了,而不是學到通則。

**資料增強(data augmentation)** 是視覺領域對抗過擬合最有效的武器:

> 每次訓練時,把影像**隨機**裁切、翻轉、調色一下。模型每個 epoch 看到的都是「同一張圖的不同變體」,等於免費擴增了資料,被迫學到**真正穩健**的特徵,而不是背圖。
"""
        ),
        md("## 1. 安裝與資料"),
        code(INSTALL_VISION),
        code(CIFAR_SRC),
        code(SHOW_SRC),
        md(
            "## 2. 定義增強管線\n\n"
            "常見的視覺增強:隨機裁切(補邊後裁)、隨機水平翻轉、顏色抖動。"
            "**注意:增強只用在訓練集,測試集要保持原樣**(評估要公平)。"
        ),
        code(
            '''
from torchvision import transforms

train_aug = transforms.Compose([
    transforms.RandomCrop(32, padding=4),       # 補 4 像素邊再隨機裁回 32
    transforms.RandomHorizontalFlip(),          # 隨機左右翻
    transforms.ColorJitter(0.2, 0.2, 0.2),      # 隨機調亮度/對比/飽和
    transforms.ToTensor(),
])
test_plain = transforms.Compose([transforms.ToTensor()])
'''
        ),
        md("## 3. 親眼看增強:同一張圖的 8 個隨機變體\n\n每次取出都不一樣——這正是模型每個 epoch 看到的。"),
        code(
            '''
import torch
import torchvision

raw = torchvision.datasets.CIFAR10("./data", train=True, download=True)
pil_img, label = raw[7]                          # 取一張原圖(PIL)
variants = torch.stack([train_aug(pil_img) for _ in range(8)])
print("原圖類別:", CIFAR10_CLASSES[label])
show_images(variants, cols=8)
'''
        ),
        md(
            "## 4. 過擬合的樣子:訓練 vs 驗證的差距\n\n"
            "沒有增強時,模型很容易訓練準確率衝很高、但測試準確率卡住——兩者拉開的**那道縫**就是過擬合。"
            "把上面的 `train_aug` 換進 DataLoader 訓練,通常能把這道縫縮小、測試準確率往上。"
        ),
        code(
            '''
# 觀念示意:訓練時用 train_aug(資料增強)、評估時用 test_plain(原樣)。
# train_set = torchvision.datasets.CIFAR10("./data", train=True, transform=train_aug)
# test_set  = torchvision.datasets.CIFAR10("./data", train=False, transform=test_plain)
print("規則:增強只加在訓練集；測試集保持原樣,評估才公平。")
print("加了增強後,train/val 準確率的差距(過擬合的縫)會縮小。")
'''
        ),
        md(
            """
## 小結

- **過擬合 = 背訓練圖、學不到通則**,徵兆是訓練準確率 ≫ 測試準確率。
- **資料增強**用隨機裁切/翻轉/調色,讓模型每次看到不同變體,被迫學穩健特徵。
- 鐵則:**增強只用於訓練集**,測試集保持原樣。
- 搭配上一課的遷移學習,是榨出視覺模型效能的標準組合。

下一課:跳出「分類」——讓模型不只說「是什麼」,還要框出「在哪裡」:**物件偵測**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-data-augmentation.ipynb")


if __name__ == "__main__":
    print("產生 cv lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
