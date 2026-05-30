"""產生 cv 軌道 lessons 05–08 的 notebook（深度電腦視覺）。

用法：
    notebooks/.venv/bin/python notebooks/gen_cv_5to8.py

比照 agent/rl 軌道：**無輸出提交**，留 Colab T4 跑。L05/L06 用 ultralytics(YOLO)、
L07 用 pytorch-grad-cam、L08 遷移學習收尾。
"""

from _cv_shared import (
    CIFAR_SRC,
    INSTALL_GRADCAM,
    INSTALL_ULTRALYTICS,
    INSTALL_VISION,
    LOAD_IMAGE_SRC,
)
from _nbgen import build_notebook, code, md

DIR = "cv/deep-vision"


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 物件偵測:不只「是什麼」，還要「在哪裡」

前四課都在做**分類**——一張圖回一個標籤。但真實世界一張圖裡常有很多東西。**物件偵測(object detection)** 更進一步:

> 同時回答「**有什麼**」與「**在哪裡**」——框出每個物件的**邊界框(bounding box)**、給出類別與信心分數。

自動駕駛、安防、醫療影像都靠它。這課用業界最當紅的 **YOLO**(You Only Look Once,透過 `ultralytics` 套件)直接做推論——一個預訓練模型,開箱即用。
"""
        ),
        md("## 1. 安裝 ultralytics\n\n它把 YOLO 包成幾行就能用的 API。"),
        code(INSTALL_ULTRALYTICS),
        md(
            "## 2. 載入預訓練 YOLO,對一張圖偵測\n\n"
            "`yolov8n.pt` 是最小的版本(~6MB,首次自動下載),在 COCO(80 類)上預訓練好了。"
        ),
        code(
            '''
import matplotlib.pyplot as plt
from ultralytics import YOLO

model = YOLO("yolov8n.pt")                       # 首次會自動下載權重
result = model("https://ultralytics.com/images/bus.jpg")[0]

plt.figure(figsize=(8, 6))
plt.imshow(result.plot()[:, :, ::-1])            # plot() 回傳 BGR,轉成 RGB 顯示
plt.axis("off"); plt.title("YOLO 偵測結果"); plt.show()
'''
        ),
        md("## 3. 讀出每個框的內容\n\n偵測結果是結構化資料:類別、信心、座標,都拿得到。"),
        code(
            '''
for b in result.boxes:
    cls_name = model.names[int(b.cls)]
    conf = float(b.conf)
    x1, y1, x2, y2 = [round(v, 1) for v in b.xyxy[0].tolist()]
    print(f"{cls_name:10s} 信心 {conf:.2f}  框 ({x1}, {y1})–({x2}, {y2})")
'''
        ),
        md("## 4. 換你自己的圖\n\n換成任何網址都行,試試多物件的場景。"),
        code(
            '''
res2 = model("https://ultralytics.com/images/zidane.jpg")[0]
print("偵測到:", [model.names[int(b.cls)] for b in res2.boxes])
plt.figure(figsize=(8, 5))
plt.imshow(res2.plot()[:, :, ::-1]); plt.axis("off"); plt.show()
'''
        ),
        md(
            """
## 小結

- **物件偵測 = 分類 + 定位**:回傳每個物件的邊界框、類別、信心。
- **YOLO** 透過 `ultralytics` 開箱即用:載入預訓練權重 → 丟圖 → 拿結構化結果。
- 想偵測自己的類別?用自己的標註資料 `model.train(...)` 微調即可(同遷移學習精神)。

下一課:比框更精細——逐像素切出物件輪廓的**影像分割**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-object-detection.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · 影像分割:逐像素看懂畫面

偵測畫的是方框,但方框裡仍混著背景。**影像分割(segmentation)** 更精細:

> **替每一個像素分類**,精確切出物件的輪廓。分兩種:
> - **語意分割(semantic)**:同類的像素一視同仁(所有「人」是同一片)。
> - **實例分割(instance)**:同類也分開個體(人 1、人 2、人 3 各一片)。

醫療影像、影像去背、自駕的可行駛區域都靠它。這課用 **YOLO 的分割版**做實例分割。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_ULTRALYTICS),
        md("## 2. 載入分割模型,輸出帶遮罩(mask)的結果\n\n`yolov8n-seg.pt` 會替每個物件畫出**輪廓遮罩**,不只是框。"),
        code(
            '''
import matplotlib.pyplot as plt
from ultralytics import YOLO

seg = YOLO("yolov8n-seg.pt")                      # 分割版預訓練權重
result = seg("https://ultralytics.com/images/bus.jpg")[0]

plt.figure(figsize=(8, 6))
plt.imshow(result.plot()[:, :, ::-1])             # 每個物件疊上半透明輪廓遮罩
plt.axis("off"); plt.title("YOLO 實例分割"); plt.show()
'''
        ),
        md("## 3. 遮罩其實是一堆 0/1 的張量\n\n每個物件對應一張和影像同尺寸的遮罩:屬於該物件的像素是 1、其餘是 0。"),
        code(
            '''
if result.masks is not None:
    print("遮罩張量形狀:", tuple(result.masks.data.shape))   # (物件數, 高, 寬)
    print("偵測到的物件:", [seg.names[int(b.cls)] for b in result.boxes])
    print("→ 每個物件一張逐像素遮罩,可拿來去背、去填色、算面積。")
'''
        ),
        md(
            "## 4. 兩條技術路線\n\n"
            "- **實例分割**(這課的 YOLO-seg):物件導向,同類也分個體,適合「數有幾個、各自切開」。\n"
            "- **語意分割**(如 torchvision 的 `deeplabv3`):像素導向,適合「整片道路 / 整片天空」這種場景理解。\n\n"
            "選哪個看任務:要區分個體用實例,要理解整片區域用語意。"
        ),
        code(
            '''
# 語意分割的另一條路(torchvision 內建,概念示意):
# from torchvision.models.segmentation import deeplabv3_resnet50, DeepLabV3_ResNet50_Weights
# w = DeepLabV3_ResNet50_Weights.DEFAULT
# model = deeplabv3_resnet50(weights=w).eval()
# out = model(w.transforms()(img).unsqueeze(0))["out"]      # 每像素一個類別分數
print("實例分割:YOLO-seg；語意分割:deeplabv3。看任務選工具。")
'''
        ),
        md(
            """
## 小結

- **分割 = 逐像素分類**,比邊界框更精細,切得出輪廓。
- **語意**(同類合一)vs **實例**(同類分個體),依任務選。
- YOLO-seg 開箱即用拿到遮罩張量,可去背、算面積、做後續處理。

下一課:模型說它看到一隻貓——但它**到底在看圖的哪裡**?用 Grad-CAM 打開黑盒子。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-segmentation.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · Grad-CAM:模型到底在看哪裡?

CNN 說「這是一隻狗」,信心 98%。但它是**看了狗的臉**才這樣判斷,還是**看了背景的草地**剛好猜對?分不清楚,你就不敢信任它。

**Grad-CAM** 是最常用的 CNN 可解釋性工具:

> 它利用最後一層卷積的梯度,算出影像上**哪些區域對「這個預測」貢獻最大**,畫成一張熱力圖疊在原圖上。紅的地方,就是模型「盯著看」的地方。

這呼應 `ml/scikit-learn` 軌道教過的 SHAP——同樣是「打開黑盒子、解釋模型為什麼這樣判斷」。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_VISION),
        code(INSTALL_GRADCAM),
        code(LOAD_IMAGE_SRC),
        md(
            "## 2. 載入預訓練 ResNet-50,先做一次預測\n\n"
            "用 torchvision 內建的權重,連 ImageNet 的類別名稱一起拿到。"
        ),
        code(
            '''
import torch
from torchvision.models import resnet50, ResNet50_Weights

weights = ResNet50_Weights.DEFAULT
model = resnet50(weights=weights).eval()
preprocess = weights.transforms()
categories = weights.meta["categories"]

# 經典的貓+狗範例圖(grad-cam 套件自帶)
img = load_image("https://raw.githubusercontent.com/jacobgil/pytorch-grad-cam/master/examples/both.png")
x = preprocess(img).unsqueeze(0)
with torch.no_grad():
    probs = model(x).softmax(1)[0]
top = int(probs.argmax())
print(f"預測:{categories[top]}  信心 {probs[top]:.2f}")
'''
        ),
        md(
            "## 3. 算 Grad-CAM 熱力圖\n\n"
            "目標層選**最後一個卷積區塊**(`layer4[-1]`)——它的特徵圖最具語意。"
            "熱力圖疊回原圖,紅 = 模型最看重的區域。"
        ),
        code(
            '''
import numpy as np
import matplotlib.pyplot as plt
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

cam = GradCAM(model=model, target_layers=[model.layer4[-1]])
grayscale = cam(input_tensor=x, targets=[ClassifierOutputTarget(top)])[0]

rgb = np.array(img.resize((224, 224))).astype("float32") / 255.0
vis = show_cam_on_image(rgb, grayscale, use_rgb=True)

fig, ax = plt.subplots(1, 2, figsize=(9, 4.5))
ax[0].imshow(rgb); ax[0].set_title("原圖"); ax[0].axis("off")
ax[1].imshow(vis); ax[1].set_title(f"Grad-CAM: {categories[top]}"); ax[1].axis("off")
plt.tight_layout(); plt.show()
'''
        ),
        md(
            "## 4. 換一個目標類別,看它改看哪裡\n\n"
            "同一張貓+狗的圖,叫它解釋「另一個類別」,熱力圖會移到對應的動物身上——"
            "證明模型確實**分得清不同物件在圖的哪裡**。"
        ),
        code(
            '''
# 取信心第二高的類別,看熱區是否移動
second = int(probs.argsort(descending=True)[1])
g2 = cam(input_tensor=x, targets=[ClassifierOutputTarget(second)])[0]
vis2 = show_cam_on_image(rgb, g2, use_rgb=True)
plt.figure(figsize=(4.5, 4.5))
plt.imshow(vis2); plt.title(f"Grad-CAM: {categories[second]}"); plt.axis("off"); plt.show()
'''
        ),
        md(
            """
## 小結

- **Grad-CAM 打開 CNN 黑盒子**:用梯度算出哪些區域對某預測貢獻最大,畫成熱力圖。
- 能抓出「**看對地方**」還是「**靠背景瞎猜**」——除錯與建立信任的利器。
- 與 sklearn 軌道的 **SHAP** 一脈相承:可解釋性是把模型用在真實場景的必修課。

下一課(壓軸):把整條軌道串起來,做一個完整的影像分類專案。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-grad-cam.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 端到端實戰:完整影像分類專案

整條軌道的收尾。把學到的東西串成一個**完整流程**:遷移學習 + 資料增強訓練一個分類器,對單張圖做推論,存檔,最後聊怎麼**部署到瀏覽器**——呼應本站的做法。
"""
        ),
        md("## 1. 安裝與資料(遷移學習 + 增強)"),
        code(INSTALL_VISION),
        code(CIFAR_SRC),
        code(
            '''
import torch
import torch.nn as nn
import torchvision
from torchvision import transforms
from torch.utils.data import DataLoader
from torchvision.models import resnet18, ResNet18_Weights

device = "cuda" if torch.cuda.is_available() else "cpu"
IMAGENET_MEAN, IMAGENET_STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)

train_tf = transforms.Compose([
    transforms.Resize(224), transforms.RandomHorizontalFlip(),
    transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])
test_tf = transforms.Compose([
    transforms.Resize(224), transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])
train_set = torchvision.datasets.CIFAR10("./data", train=True, download=True, transform=train_tf)
test_set = torchvision.datasets.CIFAR10("./data", train=False, download=True, transform=test_tf)
train_loader = DataLoader(train_set, batch_size=128, shuffle=True, num_workers=2)
test_loader = DataLoader(test_set, batch_size=256, num_workers=2)
'''
        ),
        md("## 2. 組裝模型:預訓練 ResNet-18 + 新頭"),
        code(
            '''
model = resnet18(weights=ResNet18_Weights.DEFAULT)
for p in model.parameters():
    p.requires_grad = False
model.fc = nn.Linear(model.fc.in_features, 10)
model = model.to(device)

opt = torch.optim.Adam(model.fc.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()
for ep in range(1, 4):
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        opt.zero_grad(); loss_fn(model(x), y).backward(); opt.step()
    print(f"epoch {ep}/3 完成")
print("訓練完成。")
'''
        ),
        md("## 3. 評估"),
        code(
            '''
model.eval()
correct = total = 0
with torch.no_grad():
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        correct += (model(x).argmax(1) == y).sum().item()
        total += y.size(0)
print(f"測試準確率:{100 * correct / total:.1f}%")
'''
        ),
        md("## 4. 單張圖推論 demo:Top-3 預測\n\n拿一張測試圖,看模型最有把握的前三名。"),
        code(
            '''
import matplotlib.pyplot as plt

raw = torchvision.datasets.CIFAR10("./data", train=False)
pil_img, true_label = raw[12]
x = test_tf(pil_img).unsqueeze(0).to(device)
with torch.no_grad():
    probs = model(x).softmax(1)[0]
top3 = probs.topk(3)
plt.imshow(pil_img); plt.axis("off")
plt.title("真實: " + CIFAR10_CLASSES[true_label]); plt.show()
print("Top-3 預測:")
for p, idx in zip(top3.values, top3.indices):
    print(f"  {CIFAR10_CLASSES[int(idx)]:8s} {float(p):.2%}")
'''
        ),
        md("## 5. 存檔 + 部署思路"),
        code(
            '''
torch.save(model.state_dict(), "cifar_resnet18.pt")
print("模型已存檔。")

# 要搬上網頁?把模型匯出成 ONNX,前端用 onnxruntime-web 或轉 TF.js 即可瀏覽器即時推論:
# dummy = torch.randn(1, 3, 224, 224, device=device)
# torch.onnx.export(model, dummy, "cifar_resnet18.onnx", input_names=["image"])
'''
        ),
        md(
            """
## 從 Colab 到瀏覽器:本站怎麼做

本站的 **MNIST 手寫辨識**等小工具,就是把訓練好的視覺模型搬進瀏覽器即時跑:

- 模型在 Python/Colab 訓練好後,**匯出成 ONNX 或 TF.js 格式**。
- 前端用 **TensorFlow.js / onnxruntime-web** 載入,在使用者瀏覽器**本地推論**——不需要伺服器、不上傳影像、零延遲。
- 這跟 `rl` 軌道把 agent 權重匯出到瀏覽器是同一套思路:**Colab 訓練 → 匯出 → 前端即時推論**。

## 軌道小結

你從**影像即張量**,一路做到能解釋、能偵測、能上線:

- **影像張量 / 前處理**(01)→ **CNN on CIFAR**(02)
- **遷移學習**(03)→ **資料增強**(04):用更少資源做更準的分類
- **物件偵測 YOLO**(05)→ **影像分割**(06):從「是什麼」到「在哪裡、什麼形狀」
- **Grad-CAM 可解釋性**(07)→ **端到端專案 + 部署**(08)

**會用預訓練模型、懂遷移學習、能解釋與部署**——這正是業界電腦視覺工程師的日常工具箱。📷
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-project.ipynb")


if __name__ == "__main__":
    print("產生 cv lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
