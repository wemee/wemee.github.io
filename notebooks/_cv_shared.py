"""cv 軌道共用素材：安裝字串 + CIFAR 常數 + 影像顯示工具。

跟其他軌道一樣，把每個 notebook 都會重複的程式集中成字串再注入，
讓 notebook 自成一體（Colab 可獨立開啟）。

cv 軌道用到的套件多在 Colab 一鍵 pip（torchvision、timm、ultralytics、grad-cam），
訓練吃 GPU；比照 agent/rl 軌道 **無輸出提交**，留 Colab T4 執行。
"""

# 各課按需安裝（Colab 多半已內建 torch；其餘現裝）。
INSTALL_VISION = '%pip install -q -U torchvision'
INSTALL_TIMM = '%pip install -q -U timm'
INSTALL_ULTRALYTICS = '%pip install -q -U ultralytics'
INSTALL_GRADCAM = '%pip install -q -U grad-cam'

# CIFAR-10 類別名稱與正規化常數（L01–L04、L08 共用）。
CIFAR_SRC = '''
# CIFAR-10 的 10 個類別，以及這個資料集慣用的正規化平均/標準差。
CIFAR10_CLASSES = ["plane", "car", "bird", "cat", "deer",
                   "dog", "frog", "horse", "ship", "truck"]
CIFAR10_MEAN = (0.4914, 0.4822, 0.4465)
CIFAR10_STD = (0.2470, 0.2435, 0.2616)
'''

# 把一批張量影像畫成 grid 的小工具（多課共用）。
SHOW_SRC = '''
import matplotlib.pyplot as plt
import torch


def show_images(imgs, labels=None, classes=None, cols=8, denorm=None):
    """把一批張量影像 [N,C,H,W] 畫成 grid。

    denorm=(mean,std) 時會先反正規化回 0~1 再顯示（不然正規化過的圖會怪怪的）。
    """
    imgs = imgs.detach().cpu()
    n = len(imgs)
    rows = (n + cols - 1) // cols
    plt.figure(figsize=(cols * 1.3, rows * 1.45))
    for i in range(n):
        img = imgs[i]
        if denorm is not None:
            mean, std = denorm
            img = img * torch.tensor(std).view(-1, 1, 1) + torch.tensor(mean).view(-1, 1, 1)
        img = img.clamp(0, 1).permute(1, 2, 0).numpy()
        ax = plt.subplot(rows, cols, i + 1)
        ax.imshow(img)
        ax.axis("off")
        if labels is not None:
            lab = labels[i].item() if hasattr(labels[i], "item") else labels[i]
            ax.set_title(classes[lab] if classes else str(lab), fontsize=8)
    plt.tight_layout()
    plt.show()
'''

# 從 URL 載一張圖成 PIL.Image（偵測/分割/Grad-CAM 課示範用）。
LOAD_IMAGE_SRC = '''
import requests
from PIL import Image


def load_image(url):
    """從網址載一張圖,回傳 RGB 的 PIL.Image。"""
    return Image.open(requests.get(url, stream=True).raw).convert("RGB")
'''
