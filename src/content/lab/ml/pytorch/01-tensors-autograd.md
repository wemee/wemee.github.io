---
title: "Tensor 與 autograd"
description: "深度學習要自己搭神經網路。先把 PyTorch 的兩塊地基打牢：Tensor（會算梯度的陣列）與 autograd（自動微分）——整個深度學習的引擎。"
track: ml
module: pytorch
order: 1
notebook: ml/pytorch/01-tensors-autograd.ipynb
preview: /lab/ml/pytorch/01-tensors-autograd.webp
difficulty: 入門
tags: [pytorch, tensor, autograd, gradient]
---

前面的 sklearn / XGBoost 都是「呼叫現成模型」。深度學習不一樣——你要**自己搭神經網路**。但別怕,PyTorch 的兩塊地基其實很單純:**Tensor**(會算梯度的陣列)與 **autograd**(自動微分)。

## 這堂課你會學到

- 建立、操作 **Tensor**,知道它跟 NumPy 陣列的關係
- 理解 `requires_grad` 與 `backward()` 如何自動算梯度
- 親手驗證 autograd 算出的梯度跟手算的一致

## 為什麼這是整個深度學習的引擎

神經網路的訓練,本質就是不斷算「loss 對每個參數的梯度」,再讓參數沿梯度反方向走一小步,把 loss 降下去。**autograd 幫你自動算出所有梯度**——你只要寫 forward,反向傳播 PyTorch 全包了。

預覽圖就是這個概念:在 `f(x)=x²` 上,autograd 算出每點的梯度(紅箭頭指向讓 y 下降的方向)。訓練時 optimizer 做的就是沿著這些箭頭走。把 Tensor 與 autograd 搞懂,後面搭網路、寫訓練迴圈都只是組裝這兩塊。

> 👉 在 Colab 裡對 `y = x**3 + 2*x` 用 autograd 求導,跟手算的 `3x²+2` 比對,親手確認它沒騙你。
