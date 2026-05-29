---
title: "分類：把決策邊界畫出來"
description: "比較 KNN 與邏輯迴歸兩個分類器，並把模型腦中的『決策邊界』畫出來——看它到底把空間怎麼切，一眼看懂模型的假設。"
track: ml
module: scikit-learn
order: 2
notebook: ml/scikit-learn/02-classification.ipynb
preview: /lab/ml/scikit-learn/02-classification.webp
difficulty: 入門
tags: [scikit-learn, classification, KNN, logistic-regression, decision-boundary]
---

分類模型其實是把整個特徵空間**畫分成幾塊**，每塊對應一個預測類別。塊與塊的分界，就是**決策邊界**。把它畫出來，你就能一眼看穿模型的「世界觀」——這比看一個準確率數字有感多了。

## 這堂課你會學到

- 用 **KNN** 與 **邏輯迴歸** 做分類並比較
- 理解什麼是 **決策邊界（decision boundary）**
- 學會視覺化 2D 決策邊界：鋪網格 → 逐點 `predict` → `contourf` 塗色

## 一眼看懂模型的假設

上方預覽圖就是本課的高潮：同一份鳶尾花資料，兩個模型切出完全不同形狀的邊界。

- **KNN** 的邊界**彎彎曲曲**，緊貼資料——它沒有預設形狀，完全跟著鄰居走。
- **邏輯迴歸** 的邊界是**直線**——它假設類別之間用直線就能分開。

沒有誰絕對較好：資料若大致線性可分，邏輯迴歸又快又穩；邊界很不規則時，KNN 這類彈性模型更貼合。把 KNN 的 `k` 調到 1，邊界會碎裂成過度貼合每個點的形狀——那就是**過擬合**的長相。

> 👉 在 Colab 裡，試著加入第三個分類器 `SVC(kernel="rbf")` 畫進去比較，或換一組特徵看哪組比較好分。
