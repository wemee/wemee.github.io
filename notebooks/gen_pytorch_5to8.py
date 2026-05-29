"""產生 ml/pytorch 模組 lessons 05–08 的 notebook。

用法：
    notebooks/.venv/bin/python notebooks/gen_pytorch_5to8.py
執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/ml/pytorch/0{5,6,7,8}-*.ipynb
"""

from _nbgen import build_notebook, code, md

DIR = "ml/pytorch"


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 過擬合與正則化

神經網路參數多、能力強，所以特別容易**過擬合**——把訓練資料背得滾瓜爛熟，對沒看過的資料卻很差。這堂課先製造過擬合給你看，再用 **dropout** 和 **weight decay** 把它壓下去。
"""
        ),
        md(
            """
## 學習目標

- 用「訓練 vs 測試」準確率曲線看見過擬合
- 用 **dropout** 隨機關閉神經元，逼網路別死背
- 用 **weight decay**（L2）懲罰過大的權重
- 知道 **data augmentation** 的概念
"""
        ),
        md(
            """
## 1. 故意製造過擬合

只用 **500 筆** MNIST 訓練、跑很多輪，網路會輕鬆背完訓練集。我們逐輪記錄訓練與測試準確率。
"""
        ),
        code(
            """
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

torch.manual_seed(0)
tfm = transforms.ToTensor()
train_full = datasets.MNIST("data", train=True, download=True, transform=tfm)
test_full = datasets.MNIST("data", train=False, download=True, transform=tfm)
train = Subset(train_full, range(500))          # 故意只用很少資料
test = Subset(test_full, range(2000))
train_loader = DataLoader(train, batch_size=64, shuffle=True)
test_loader = DataLoader(test, batch_size=512)

def acc(model, loader):
    model.eval(); c = 0; n = 0
    with torch.no_grad():
        for xb, yb in loader:
            c += (model(xb).argmax(1) == yb).sum().item(); n += len(yb)
    return c / n

def train_track(model, epochs=40, weight_decay=0.0):
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=weight_decay)
    crit = nn.CrossEntropyLoss()
    tr, te = [], []
    for _ in range(epochs):
        model.train()
        for xb, yb in train_loader:
            opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
        tr.append(acc(model, train_loader)); te.append(acc(model, test_loader))
    return tr, te

def make_mlp(dropout=0.0):
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 256), nn.ReLU(), nn.Dropout(dropout),
        nn.Linear(256, 256), nn.ReLU(), nn.Dropout(dropout),
        nn.Linear(256, 10),
    )

torch.manual_seed(0)
tr_plain, te_plain = train_track(make_mlp(dropout=0.0))
print(f"無正則化 → 訓練 {tr_plain[-1]:.1%}　測試 {te_plain[-1]:.1%}")
"""
        ),
        code(
            """
plt.plot(tr_plain, label="train acc")
plt.plot(te_plain, label="test acc")
plt.xlabel("epoch"); plt.ylabel("accuracy"); plt.legend()
plt.title("Overfitting: train hits ~100%, test lags far behind")
plt.show()
"""
        ),
        md(
            """
訓練準確率衝到 ~100%，測試卻卡在低點——兩條線之間的鴻溝就是過擬合。

## 2. 加上 dropout + weight decay

- **Dropout**：訓練時隨機把一部分神經元歸零，逼網路不能依賴特定幾個神經元、學更穩健的特徵。
- **Weight decay**：在 loss 裡加一項懲罰大權重（L2），讓模型更平滑。
"""
        ),
        code(
            """
torch.manual_seed(0)
tr_reg, te_reg = train_track(make_mlp(dropout=0.4), weight_decay=1e-3)
print(f"有正則化 → 訓練 {tr_reg[-1]:.1%}　測試 {te_reg[-1]:.1%}")

plt.plot(te_plain, label="test (no reg)")
plt.plot(te_reg, label="test (dropout + weight decay)")
plt.xlabel("epoch"); plt.ylabel("test accuracy"); plt.legend()
plt.title("Regularization narrows the gap")
plt.show()
"""
        ),
        md(
            """
正則化後，訓練準確率不再貼到 100%，但**測試準確率提升**——犧牲一點背書能力，換來更好的泛化。

> **Data augmentation** 是另一招：對訓練影像隨機平移、旋轉、翻轉，等於免費變出更多樣本，是視覺任務對抗過擬合的標配（`torchvision.transforms` 內建）。

## 小結

- 神經網路容易過擬合：訓練分數高、測試分數差。
- **Dropout** 隨機關神經元、**weight decay** 懲罰大權重，都能改善泛化。
- **Data augmentation** 靠隨機變換訓練資料來擴增樣本。

## 練習

1. 把 dropout 調到 0.7，測試準確率還會更好嗎？還是反而變差（正則化過頭）？
2. 把訓練資料從 500 加到 5000，過擬合的鴻溝會縮小嗎？

下一課，學會把訓練搬到 **GPU** 上加速。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-regularization.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · 用 GPU 加速

深度學習慢，是因為有海量的矩陣運算。**GPU** 能平行處理這些運算，常常快上幾十倍。這堂課教你寫**裝置無關**的程式，並親手量一次 GPU 的加速。
"""
        ),
        md(
            """
## 學習目標

- 偵測可用裝置（CUDA / Apple MPS / CPU）並寫出裝置無關的程式
- 理解 GPU 為何適合神經網路
- 親手 benchmark CPU vs GPU 的矩陣運算
"""
        ),
        md(
            """
## 1. 選一個裝置

標準寫法：能用 GPU 就用，否則退回 CPU。Colab 上是 `cuda`，Mac 上是 `mps`。
"""
        ),
        code(
            """
import torch

if torch.cuda.is_available():
    device = "cuda"           # Colab / NVIDIA GPU
elif torch.backends.mps.is_available():
    device = "mps"            # Apple Silicon
else:
    device = "cpu"
print("使用裝置:", device)
"""
        ),
        md(
            """
> 在 Colab：**執行階段 → 變更執行階段類型 → 選 GPU（T4）**，這格就會印出 `cuda`，免費。
"""
        ),
        md(
            """
## 2. 為什麼 GPU 快？

神經網路的核心是**大量矩陣相乘**。CPU 有少數幾個強核心、循序處理；GPU 有數千個小核心，能**同時**算成千上萬個乘加。下面量一次看看——但先講清楚一個誠實的提醒：
"""
        ),
        code(
            """
import time

def bench(dev, size=4000, reps=20):
    a = torch.randn(size, size, device=dev)
    b = torch.randn(size, size, device=dev)
    if dev != "cpu":
        (a @ b); torch.mps.synchronize() if dev == "mps" else torch.cuda.synchronize()
    t = time.perf_counter()
    for _ in range(reps):
        c = a @ b
    if dev == "mps": torch.mps.synchronize()
    elif dev == "cuda": torch.cuda.synchronize()
    return (time.perf_counter() - t) / reps

cpu_t = bench("cpu")
print(f"CPU:  {cpu_t * 1000:7.1f} ms / matmul")
if device != "cpu":
    gpu_t = bench(device)
    print(f"{device.upper():4}: {gpu_t * 1000:7.1f} ms / matmul")
    print(f"\\n{device} 相對 CPU：{cpu_t / gpu_t:.1f}×（>1 才是加速）")
    print("註：Mac 的 MPS 在這種中等大小的『單一』運算上，常因啟動/傳輸成本看不出優勢，")
    print("    甚至比 CPU 慢。真正的加速在 Colab 的 CUDA GPU + 大模型整段訓練時才顯著（常達數十倍）。")
"""
        ),
        md(
            """
## 3. 裝置無關的訓練

把**模型**和**每個 batch 的資料**都 `.to(device)`，其餘程式碼一字不改。這就是讓同一份程式在 CPU 與 GPU 上都能跑的全部訣竅。

```python
model = MyModel().to(device)
for xb, yb in loader:
    xb, yb = xb.to(device), yb.to(device)   # ← 唯一要加的兩行
    optimizer.zero_grad()
    loss = criterion(model(xb), yb)
    loss.backward()
    optimizer.step()
```

## 小結

- 用 `cuda` / `mps` / `cpu` 的判斷式寫**裝置無關**程式。
- GPU 靠數千核心**平行**做矩陣運算，矩陣越大越快。
- 只要把 model 與每個 batch `.to(device)`，訓練就搬上 GPU 了。

## 練習

1. 把 benchmark 的矩陣 `size` 從 4000 改成 1000 和 8000，加速比怎麼變？
2. 在 Colab 開 GPU，把第 04 課的 CNN 用全部 6 萬筆 MNIST 訓練，比 CPU 快多少？

下一課，學會站在巨人肩膀上——**遷移學習**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-gpu.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · 遷移學習

從零訓練一個大模型要海量資料與算力。**遷移學習**讓你站在巨人肩膀上：拿一個在百萬張圖上預訓練好的模型，借用它學到的「視覺特徵」，只花少少資料就解決你自己的任務。
"""
        ),
        md(
            """
## 學習目標

- 載入預訓練的 `resnet18`
- 把它當成**凍結的特徵萃取器**
- 在少量資料上，比較「遷移學習」與「從零訓練」
"""
        ),
        md(
            """
## 1. 載入預訓練模型

`torchvision` 提供一堆在 ImageNet（百萬張、1000 類）上訓練好的模型。`resnet18` 是輕量又經典的選擇。
"""
        ),
        code(
            """
import torch
import torch.nn as nn
from torchvision import models
from torchvision.models import ResNet18_Weights

torch.manual_seed(0)
weights = ResNet18_Weights.DEFAULT
resnet = models.resnet18(weights=weights)   # 下載預訓練權重（約 45MB）
resnet.eval()
print("ResNet18 載入完成，最後一層原本是:", resnet.fc)
"""
        ),
        md(
            """
## 2. 當成「特徵萃取器」

把最後的分類層換掉，前面所有層**凍結**（不訓練）。這樣 resnet 就變成一台「把影像轉成 512 維特徵向量」的機器，我們再用這些特徵接一個簡單分類器。

我們用 **CIFAR-10**（10 類自然影像：飛機、貓、船…）。它跟 resnet 預訓練的 ImageNet 同樣是自然照片，所以特徵**轉得過去**——這正是遷移學習發威的場景。為了快，只取小子集。
"""
        ),
        code(
            """
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

# resnet 需要較大尺寸與 ImageNet 正規化；CIFAR 本來就是 3 通道彩色
tfm = transforms.Compose([
    transforms.Resize(64),
    transforms.ToTensor(),
    transforms.Normalize(weights.transforms().mean, weights.transforms().std),
])
train = Subset(datasets.CIFAR10("data", train=True, download=True, transform=tfm), range(1500))
test = Subset(datasets.CIFAR10("data", train=False, download=True, transform=tfm), range(500))

feature_extractor = nn.Sequential(*list(resnet.children())[:-1])  # 去掉最後的 fc
for p in feature_extractor.parameters():
    p.requires_grad = False

def extract(dataset):
    xs, ys = [], []
    with torch.no_grad():
        for xb, yb in DataLoader(dataset, batch_size=64):
            feats = feature_extractor(xb).flatten(1)   # (batch, 512)
            xs.append(feats); ys.append(yb)
    return torch.cat(xs), torch.cat(ys)

Xtr, ytr = extract(train)
Xte, yte = extract(test)
print("萃取出的特徵維度:", Xtr.shape)
"""
        ),
        md(
            """
## 3. 遷移學習 vs 從零訓練

在這 1500 張小資料上比兩種做法：
- **遷移學習**：在凍結的 resnet 特徵上，只訓練一個線性分類器。
- **從零訓練**：一個小 CNN，直接在 1500 張上學。
"""
        ),
        code(
            """
def train_clf(model, X, y, epochs=80, lr=1e-3):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    crit = nn.CrossEntropyLoss()
    for _ in range(epochs):
        opt.zero_grad(); crit(model(X), y).backward(); opt.step()
    return model

# (a) 遷移學習：線性分類器接在預訓練特徵上
linear = train_clf(nn.Linear(512, 10), Xtr, ytr)
with torch.no_grad():
    transfer_acc = (linear(Xte).argmax(1) == yte).float().mean().item()

# (b) 從零訓練的小 CNN（用原始影像，公平起見也只看 1500 張）
raw_tfm = transforms.Compose([transforms.Resize(64), transforms.ToTensor()])
raw_train = Subset(datasets.CIFAR10("data", train=True, download=True, transform=raw_tfm), range(1500))
raw_test = Subset(datasets.CIFAR10("data", train=False, download=True, transform=raw_tfm), range(500))
small_cnn = nn.Sequential(
    nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
    nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
    nn.Flatten(), nn.Linear(32 * 16 * 16, 10),
)
opt = torch.optim.Adam(small_cnn.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
for _ in range(12):
    for xb, yb in DataLoader(raw_train, batch_size=64, shuffle=True):
        opt.zero_grad(); crit(small_cnn(xb), yb).backward(); opt.step()
small_cnn.eval(); correct = 0
with torch.no_grad():
    for xb, yb in DataLoader(raw_test, batch_size=128):
        correct += (small_cnn(xb).argmax(1) == yb).sum().item()
scratch_acc = correct / len(raw_test)

print(f"遷移學習（凍結 resnet 特徵 + 線性分類器）：{transfer_acc:.1%}")
print(f"從零訓練的小 CNN：                       {scratch_acc:.1%}")
"""
        ),
        md(
            """
資料很少時，遷移學習通常明顯勝出——因為 resnet 早就從百萬張圖學會「邊緣、紋理、形狀」這些通用視覺特徵，不必用你的 1500 張重新學一遍。

> 進階做法叫 **fine-tuning**：不只訓練新的分類頭，還用很小的學習率微調 resnet 後面幾層，讓特徵更貼合你的任務。

## 小結

- **遷移學習** = 借用預訓練模型學到的通用特徵。
- 凍結 backbone、只換/訓練分類頭，少量資料也能有好表現。
- 資料越少，遷移學習相對「從零訓練」的優勢越大。

## 練習

1. 把訓練資料從 600 減到 100，兩種做法的差距會拉得更大嗎？
2. 試著解凍 resnet 最後一個 block，用很小的 lr 一起微調，準確率有提升嗎？

最後一課，把所有東西串成一個**完整專案**並談部署。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-transfer-learning.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 完整專案與部署

把前七課全部串起來，在 **FashionMNIST**（衣服圖片）上訓練一個完整的 CNN 分類器，並學會**存檔、載入、部署**——讓模型走出 notebook，真正用起來。這是深度學習模組的收尾。
"""
        ),
        md(
            """
## 學習目標

- 串起完整流程：資料 → CNN（含 dropout）→ 訓練/驗證 → 評估
- 用 `torch.save` / `load_state_dict` 存檔與載入模型
- 認識部署選項（ONNX、TF.js）——呼應本站用 TF.js 在瀏覽器跑模型的遊戲 AI
"""
        ),
        md(
            """
## 1. 資料：FashionMNIST

跟 MNIST 同格式（28×28、10 類），但內容是 T 恤、鞋子、包包等——比數字更有挑戰。
"""
        ),
        code(
            """
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

torch.manual_seed(0)
device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
tfm = transforms.ToTensor()
train = Subset(datasets.FashionMNIST("data", train=True, download=True, transform=tfm), range(10000))
test = Subset(datasets.FashionMNIST("data", train=False, download=True, transform=tfm), range(2000))
classes = ["T-shirt", "Trouser", "Pullover", "Dress", "Coat",
           "Sandal", "Shirt", "Sneaker", "Bag", "Ankle boot"]
train_loader = DataLoader(train, batch_size=64, shuffle=True)
test_loader = DataLoader(test, batch_size=256)

fig, axes = plt.subplots(1, 8, figsize=(11, 1.8))
for ax, (img, label) in zip(axes, train):
    ax.imshow(img.squeeze(), cmap="gray"); ax.set_title(classes[label], fontsize=7); ax.axis("off")
plt.show()
"""
        ),
        md(
            """
## 2. 訓練一個完整的 CNN
"""
        ),
        code(
            """
model = nn.Sequential(
    nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
    nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
    nn.Flatten(), nn.Dropout(0.3),
    nn.Linear(64 * 7 * 7, 128), nn.ReLU(),
    nn.Linear(128, 10),
).to(device)

opt = torch.optim.Adam(model.parameters(), lr=1e-3)
crit = nn.CrossEntropyLoss()

def accuracy(loader):
    model.eval(); c = 0; n = 0
    with torch.no_grad():
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            c += (model(xb).argmax(1) == yb).sum().item(); n += len(yb)
    return c / n

for epoch in range(5):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
    print(f"epoch {epoch + 1}: test acc = {accuracy(test_loader):.1%}")
"""
        ),
        md(
            """
## 3. 存檔與載入

訓練好的模型要能存下來、之後直接載入用，不必重訓。慣例是只存 `state_dict`（參數）。
"""
        ),
        code(
            """
# 存檔
torch.save(model.state_dict(), "fashion_cnn.pt")
print("已儲存 fashion_cnn.pt")

# 載入到一個結構相同的新模型
import copy
fresh = copy.deepcopy(model)            # 同樣的結構
fresh.load_state_dict(torch.load("fashion_cnn.pt"))
fresh.eval()
print(f"重新載入後的測試準確率：{accuracy(test_loader):.1%}  (應與訓練後一致)")
"""
        ),
        md(
            """
## 4. 部署：讓模型走出 notebook

訓練只是第一步，要用起來得**部署**。常見路線：

- **ONNX**：`torch.onnx.export(model, sample, "model.onnx")` 匯出成跨框架的標準格式，可在伺服器、行動裝置、瀏覽器執行。
- **TF.js**：把模型轉成 TensorFlow.js，**直接在瀏覽器跑、零後端**——本站的遊戲 AI agent 就是用這條路（見 `/game` 的強化學習對手）。流程是 PyTorch →（ONNX）→ TensorFlow → TF.js。
- **API 服務**：用 FastAPI 等包成推論 API。

```python
# ONNX 匯出範例（在 Colab 可 pip install onnx 後執行）
sample = torch.randn(1, 1, 28, 28, device=device)
torch.onnx.export(model, sample, "model.onnx", input_names=["image"], output_names=["logits"])
```

## 小結：深度學習的完整流程

1. **資料** → `DataLoader` 分批
2. **模型** → CNN + dropout，搬上 `device`
3. **訓練/評估** → 訓練迴圈 + 逐輪看測試準確率
4. **存檔** → `torch.save(state_dict)`，`load_state_dict` 載回
5. **部署** → ONNX / TF.js / API

你已經走完從 tensor 到部署的完整旅程！

## 練習（綜合）

1. 把訓練資料加到全部 6 萬筆、epoch 加到 10，FashionMNIST 準確率能到多少？
2. 加上 data augmentation（`transforms.RandomHorizontalFlip()`），測試準確率有提升嗎？
3. 挑戰：在 Colab 把模型匯出成 ONNX，再研究怎麼轉成 TF.js 放到網頁上跑。

下一個學習階段是 **大型語言模型（LLM）**——我們會從零打造一個迷你 GPT。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-capstone.ipynb")


if __name__ == "__main__":
    print("產生 pytorch lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
