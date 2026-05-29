---
title: "訓練迴圈"
description: "深度學習的心跳。記住四拍——forward → loss → backward → step，你就能訓練任何 PyTorch 模型。"
track: ml
module: pytorch
order: 3
notebook: ml/pytorch/03-training-loop.ipynb
preview: /lab/ml/pytorch/03-training-loop.webp
difficulty: 入門
tags: [pytorch, training, optimizer, loss, backprop]
---

上一課的網路只會亂猜。這堂課寫出**訓練迴圈**——深度學習的心跳。記住這四拍,你就能訓練任何 PyTorch 模型。

## 這堂課你會學到

- 背下訓練迴圈的四拍:**forward → loss → backward → step**
- 認識損失函數(`CrossEntropyLoss`)與優化器(`Adam`)
- 訓練上一課的網路,畫出 loss 曲線與學成的決策邊界

## 四拍心法

```python
optimizer.zero_grad()           # 1. 清掉上一輪的梯度
loss = criterion(model(X), y)   # 2. forward + 算 loss
loss.backward()                 # 3. 反向傳播,算每個參數的梯度
optimizer.step()                # 4. 沿梯度反方向更新參數
```

這四拍跑很多輪,每輪讓 loss 小一點。預覽圖就是訓練完的成果:一條**彎曲的決策邊界**,漂亮地把兩個半月切開——這正是上一課講的 ReLU 非線性學出來的,一條直線永遠做不到。

> 👉 在 Colab 裡把學習率 `lr` 調到 0.001,看要幾個 epoch 才追得上原本的準確率;或把隱藏層寬度從 16 改成 4,看邊界變多「鈍」。
