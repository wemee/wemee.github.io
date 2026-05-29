---
title: "你的第一個神經網路"
description: "用 nn.Module 把 Tensor 與 autograd 組成真正的神經網路。搭一個小分類器，理解激活函數為何不可少。"
track: ml
module: pytorch
order: 2
notebook: ml/pytorch/02-first-network.ipynb
preview: /lab/ml/pytorch/02-first-network.webp
difficulty: 入門
tags: [pytorch, neural-network, nn-module, activation]
---

有了 Tensor 與 autograd,這堂課用 `nn.Module` 把它們組成一個真正的**神經網路**。我們搭一個小分類器,先看它「還沒訓練」時亂猜的樣子——下一課再教怎麼訓練它。

## 這堂課你會學到

- 用 `nn.Module` 定義網路、`nn.Linear` 當全連接層
- 理解**激活函數**(ReLU)為什麼不可少
- 跑一次 forward,數一數網路有幾個參數

## 沒有激活函數，網路只是一條直線

預覽圖的 two moons 是兩個交纏的半月,一條直線分不開——正好需要神經網路。

關鍵觀念:如果把 ReLU 這類**激活函數**拿掉,幾層 `nn.Linear` 疊起來在數學上**仍只是一條直線**(線性的線性還是線性),再多層也分不開半月。是非線性激活,才讓網路能彎曲決策邊界、學到複雜模式。

`nn.Module` 的慣例很簡單:在 `__init__` 宣告各層,在 `forward` 描述資料怎麼流過。記住這個骨架,任何網路都是它的變形。

> 👉 在 Colab 裡把 `forward` 裡的 ReLU 全部移除,下一課訓練後你會看到它再也學不會半月。
