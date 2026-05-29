"""產生 ml/pytorch 模組 lessons 01–04 的 notebook。

用法：
    notebooks/.venv/bin/python notebooks/gen_pytorch_1to4.py
執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/ml/pytorch/0{1,2,3,4}-*.ipynb
"""

from _nbgen import build_notebook, code, md

DIR = "ml/pytorch"


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · Tensor 與 autograd

歡迎來到 **機器學習 → 深度學習入門（PyTorch）**。

前面的 sklearn / XGBoost 都是「呼叫現成模型」。深度學習不一樣——你要**自己搭神經網路**。但別怕，PyTorch 的兩塊地基其實很單純：**Tensor**（會算梯度的陣列）與 **autograd**（自動微分）。這堂課把這兩塊打牢。

> 💡 神經網路的訓練 = 不斷算「loss 對每個參數的梯度」再往下走。autograd 幫你自動算梯度——這是整個深度學習的引擎。建議在 Colab 開啟（之後幾課可開免費 GPU）。
"""
        ),
        md(
            """
## 學習目標

- 建立、操作 **Tensor**，知道它跟 NumPy 陣列的關係
- 理解 `requires_grad` 與 `backward()` 如何自動算梯度
- 親手驗證 autograd 算出的梯度跟手算的一致
"""
        ),
        md(
            """
## 1. Tensor：會算梯度的陣列

Tensor 就像 NumPy 的 `ndarray`，支援一樣的運算與 broadcasting——但它多了兩個超能力：能跑在 GPU 上、能自動算梯度。
"""
        ),
        code(
            """
import torch

x = torch.tensor([[1.0, 2.0], [3.0, 4.0]])
print("tensor:\\n", x)
print("形狀:", x.shape, " dtype:", x.dtype)
print("矩陣相乘 x @ x:\\n", x @ x)
print("跟 NumPy 互通:", x.numpy().sum())
"""
        ),
        md(
            """
## 2. autograd：自動微分

把 `requires_grad=True` 設給一個 tensor，PyTorch 就會**記錄所有對它做的運算**，組成一張計算圖。呼叫 `.backward()`，它會沿著圖反向把梯度算出來，存在 `.grad` 裡。

用最簡單的 `y = x²` 驗證：手算 dy/dx = 2x，在 x=3 應該是 6。
"""
        ),
        code(
            """
x = torch.tensor(3.0, requires_grad=True)
y = x ** 2
y.backward()              # 反向傳播，算 dy/dx
print(f"x = {x.item()}")
print(f"autograd 算出的 dy/dx = {x.grad.item()}   (手算 2x = {2 * x.item()})")
"""
        ),
        md(
            """
完全一致。再看一個多變數的例子，並把梯度當成「往哪走能讓 y 變小」的方向——這正是訓練神經網路在做的事。
"""
        ),
        code(
            """
import matplotlib.pyplot as plt
import numpy as np

# f(x) = x^2，在好幾個點上用 autograd 取梯度，畫出切線方向
xs = torch.linspace(-3, 3, 7, requires_grad=True)
ys = xs ** 2
ys.sum().backward()       # 對每個 x 取梯度

xs_np = xs.detach().numpy()
grads = xs.grad.numpy()
curve_x = np.linspace(-3, 3, 100)
plt.plot(curve_x, curve_x ** 2, label="f(x)=x²")
for xi, yi, g in zip(xs_np, xs_np ** 2, grads):
    plt.arrow(xi, yi, -0.3 * np.sign(g), 0, head_width=0.3, color="red", alpha=0.7)
plt.title("Gradients point uphill; training steps the opposite way")
plt.legend(); plt.show()
print("梯度 (dy/dx):", grads.round(2))
"""
        ),
        md(
            """
紅箭頭是「梯度的反方向」——也就是讓 y 下降的方向。訓練時，optimizer 就是讓每個參數沿著梯度反方向走一小步，一步一步把 loss 降下去。

## 小結

- **Tensor** = 會算梯度、能上 GPU 的 NumPy 陣列。
- `requires_grad=True` 讓 PyTorch 記錄運算，`backward()` 自動算梯度到 `.grad`。
- 訓練 = 沿梯度反方向走，逐步降低 loss。

## 練習

1. 對 `y = x**3 + 2*x` 在 x=2 用 autograd 求導，跟手算 `3x²+2` 比對。
2. 用 `torch.zeros(3, requires_grad=True)` 造一個向量，對 `y = (x**2).sum()` 反傳，看 `.grad`。

下一課，用這些零件**搭出第一個神經網路**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-tensors-autograd.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 你的第一個神經網路

有了 Tensor 與 autograd，這堂課用 `nn.Module` 把它們組成一個真正的**神經網路**。我們搭一個小分類器，先看它「還沒訓練」時亂猜的樣子——下一課再教怎麼訓練它。
"""
        ),
        md(
            """
## 學習目標

- 用 `nn.Module` 定義網路、`nn.Linear` 當全連接層
- 理解**激活函數**（ReLU）為什麼不可少
- 跑一次 forward，數一數網路有幾個參數
"""
        ),
        md(
            """
## 1. 一份非線性的資料

`make_moons` 造兩個交纏的半月——一條直線分不開，正好需要神經網路。
"""
        ),
        code(
            """
import torch
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons

torch.manual_seed(0)
X_np, y_np = make_moons(n_samples=300, noise=0.2, random_state=0)
X = torch.tensor(X_np, dtype=torch.float32)
y = torch.tensor(y_np, dtype=torch.long)

plt.scatter(X_np[:, 0], X_np[:, 1], c=y_np, cmap="coolwarm", edgecolor="k", s=25)
plt.title("Two moons: not linearly separable"); plt.show()
"""
        ),
        md(
            """
## 2. 定義網路

`nn.Module` 是所有網路的基底。慣例：在 `__init__` 裡宣告各層，在 `forward` 裡描述資料怎麼流過。
"""
        ),
        code(
            """
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(2, 16)   # 輸入 2 維 → 隱藏 16
        self.fc2 = nn.Linear(16, 16)  # 隱藏 → 隱藏
        self.fc3 = nn.Linear(16, 2)   # 隱藏 → 2 類

    def forward(self, x):
        x = torch.relu(self.fc1(x))   # 激活函數：引入非線性
        x = torch.relu(self.fc2(x))
        return self.fc3(x)            # 輸出 logits（還沒 softmax）

model = MLP()
print(model)
n_params = sum(p.numel() for p in model.parameters())
print(f"\\n總參數量：{n_params}")
"""
        ),
        md(
            """
## 3. 為什麼需要激活函數？

如果把 `torch.relu` 拿掉，幾層 `nn.Linear` 疊起來在數學上**仍只是一條直線**（線性的線性還是線性）——再多層也分不開半月。**ReLU** 這類非線性激活，才讓網路能彎曲決策邊界、學到複雜模式。

## 4. 跑一次 forward

還沒訓練的網路，權重是隨機的，預測自然是亂猜。
"""
        ),
        code(
            """
logits = model(X)                       # forward：一次餵全部資料
pred = logits.argmax(dim=1)             # 取機率最大的類別
acc = (pred == y).float().mean()
print("輸出 logits 形狀:", logits.shape)
print(f"未訓練的準確率：{acc.item():.1%}  (約 50%，等於亂猜)")
"""
        ),
        md(
            """
## 小結

- 網路繼承 `nn.Module`：`__init__` 宣告層、`forward` 描述資料流。
- `nn.Linear` 是全連接層；**激活函數（ReLU）** 提供非線性，缺它網路退化成一條直線。
- forward 出來的是 **logits**；未訓練時準確率約等於亂猜。

## 練習

1. 多加一層 `nn.Linear(16, 16)` 與對應的 ReLU，參數量變多少？
2. 把 `forward` 裡的 `torch.relu` 全部移除，未訓練準確率有變嗎？（下一課訓練後會看出差異）

下一課，寫出**訓練迴圈**，讓這個網路真的學會分半月。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-first-network.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 訓練迴圈

上一課的網路只會亂猜。這堂課寫出**訓練迴圈**——深度學習的心跳。記住這四拍，你就能訓練任何 PyTorch 模型。
"""
        ),
        md(
            """
## 學習目標

- 背下訓練迴圈的四拍：**forward → loss → backward → step**
- 認識損失函數（`CrossEntropyLoss`）與優化器（`Adam`）
- 訓練上一課的網路，畫出 loss 曲線與學成的決策邊界
"""
        ),
        md(
            """
## 1. 訓練的四拍

```python
optimizer.zero_grad()      # 1. 清掉上一輪的梯度
loss = criterion(model(X), y)  # 2. forward + 算 loss
loss.backward()            # 3. 反向傳播，算每個參數的梯度
optimizer.step()           # 4. optimizer 沿梯度反方向更新參數
```

這四拍會跑很多輪（epoch），每輪都讓 loss 小一點。
"""
        ),
        code(
            """
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons

torch.manual_seed(0)
X_np, y_np = make_moons(n_samples=300, noise=0.2, random_state=0)
X = torch.tensor(X_np, dtype=torch.float32)
y = torch.tensor(y_np, dtype=torch.long)

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2, 16), nn.ReLU(),
            nn.Linear(16, 16), nn.ReLU(),
            nn.Linear(16, 2),
        )
    def forward(self, x):
        return self.net(x)

model = MLP()
criterion = nn.CrossEntropyLoss()                      # 分類常用的損失
optimizer = torch.optim.Adam(model.parameters(), lr=0.05)

losses = []
for epoch in range(200):
    optimizer.zero_grad()
    loss = criterion(model(X), y)
    loss.backward()
    optimizer.step()
    losses.append(loss.item())

print(f"訓練後準確率：{(model(X).argmax(1) == y).float().mean():.1%}")
"""
        ),
        code(
            """
plt.plot(losses)
plt.xlabel("epoch"); plt.ylabel("loss")
plt.title("Loss goes down as the network learns")
plt.show()
"""
        ),
        md(
            """
## 2. 看它學到的決策邊界

訓練前是亂猜（~50%），訓練後應該逼近 100%。把決策邊界畫出來，看網路怎麼把兩個半月切開。
"""
        ),
        code(
            """
import numpy as np

xx, yy = np.meshgrid(np.linspace(-1.5, 2.5, 300), np.linspace(-1, 1.5, 300))
grid = torch.tensor(np.c_[xx.ravel(), yy.ravel()], dtype=torch.float32)
with torch.no_grad():
    Z = model(grid).argmax(1).numpy().reshape(xx.shape)

plt.contourf(xx, yy, Z, alpha=0.3, cmap="coolwarm")
plt.scatter(X_np[:, 0], X_np[:, 1], c=y_np, cmap="coolwarm", edgecolor="k", s=25)
plt.title("Learned decision boundary"); plt.show()
"""
        ),
        md(
            """
那條彎曲的邊界，就是 ReLU 提供的非線性學出來的——一條直線永遠做不到。

## 小結

- 訓練迴圈四拍：`zero_grad` → `backward` → `step`，包夾著 forward + loss。
- `CrossEntropyLoss` 配分類、`Adam` 是好用的預設優化器。
- loss 曲線下降 = 網路在學；學完的決策邊界能彎曲貼合資料。
- 評估/畫圖時用 `torch.no_grad()`，省記憶體也更快。

## 練習

1. 把 `lr` 改成 0.001，要幾個 epoch 才追得上原本的準確率？
2. 把隱藏層寬度從 16 改成 4，邊界會變得多「鈍」？

下一課，進入**影像**——從全連接網路升級到 CNN，辨識手寫數字。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-training-loop.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 影像辨識：從全連接到 CNN

這堂課處理真實影像——**MNIST 手寫數字**。先用全連接網路當基線，再升級到 **CNN（卷積神經網路）**，看看為什麼卷積特別適合影像。
"""
        ),
        md(
            """
## 學習目標

- 載入 MNIST，用 `DataLoader` 分批餵資料
- 理解 `nn.Conv2d` / 池化在做什麼、為何適合影像
- 比較全連接網路與 CNN 的準確率
"""
        ),
        md(
            """
## 1. 載入 MNIST

`torchvision` 一行就能下載。為了在這裡跑得快，我們只取一個子集（在 Colab 可以用全部 6 萬筆）。
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
tfm = transforms.ToTensor()   # 轉成 [0,1] 的 tensor，形狀 (1, 28, 28)
train_full = datasets.MNIST("data", train=True, download=True, transform=tfm)
test_full = datasets.MNIST("data", train=False, download=True, transform=tfm)
train = Subset(train_full, range(8000))   # 子集，加速；Colab 可拿掉
test = Subset(test_full, range(2000))
train_loader = DataLoader(train, batch_size=64, shuffle=True)
test_loader = DataLoader(test, batch_size=256)

# 看幾張長相
fig, axes = plt.subplots(1, 8, figsize=(11, 1.8))
for ax, (img, label) in zip(axes, train):
    ax.imshow(img.squeeze(), cmap="gray"); ax.set_title(str(label)); ax.axis("off")
plt.show()
"""
        ),
        code(
            """
def evaluate(model):
    model.eval()
    correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb).argmax(1) == yb).sum().item()
    return correct / len(test)

def train_model(model, epochs=3, lr=1e-3):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    crit = nn.CrossEntropyLoss()
    for _ in range(epochs):
        model.train()
        for xb, yb in train_loader:
            opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
    return model
"""
        ),
        md(
            """
## 2. 基線：全連接網路

把 28×28 的圖**攤平成 784 維向量**丟進 MLP。能用，但攤平就把「哪個像素挨著哪個」的空間結構全丟了。
"""
        ),
        code(
            """
mlp = nn.Sequential(
    nn.Flatten(),
    nn.Linear(28 * 28, 128), nn.ReLU(),
    nn.Linear(128, 10),
)
train_model(mlp)
print(f"全連接網路準確率：{evaluate(mlp):.1%}")
"""
        ),
        md(
            """
## 3. 升級：CNN

**卷積層**用一個小窗口（kernel）滑過整張圖，偵測邊緣、轉角等**局部圖樣**，而且同一個 kernel 在每個位置共用權重——既保留空間結構、參數又少。配上**池化**縮小尺寸。
"""
        ),
        code(
            """
cnn = nn.Sequential(
    nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),   # 28→14
    nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 14→7
    nn.Flatten(),
    nn.Linear(32 * 7 * 7, 10),
)
train_model(cnn)
print(f"CNN 準確率：{evaluate(cnn):.1%}")
"""
        ),
        md(
            """
即使只用一小撮資料、訓練幾輪，CNN 通常就贏過全連接網路——因為它**尊重影像的空間結構**。這也是為什麼所有現代視覺模型都建立在卷積（或其變體）之上。

## 小結

- `DataLoader` 把資料分批、打亂，餵給訓練迴圈。
- 全連接網路把圖攤平，丟掉空間結構；**CNN 用卷積保留局部圖樣、共用權重**。
- 同樣條件下，CNN 在影像上通常勝過 MLP。

## 練習

1. 把訓練子集從 8000 加到全部（`range(8000)` 改成整個 `train_full`），CNN 準確率衝到多少？
2. 在 CNN 後段加一層 `nn.Linear(…, 64)` + ReLU 再接輸出，有幫助嗎？

下一課，認識深度學習最大的敵人之一——**過擬合**，以及怎麼對付它。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-cnn.ipynb")


if __name__ == "__main__":
    print("產生 pytorch lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
