---
title: "在 CIFAR-10 上訓練一個 CNN"
description: "從 pytorch 軌道的灰階 MNIST，升級到彩色、更難的 CIFAR-10，用上現代 CNN 的標準配備：Conv→BatchNorm→ReLU 堆疊、MaxPool 降尺寸、Dropout 抗過擬合。"
track: cv
module: deep-vision
order: 2
notebook: cv/deep-vision/02-cnn-cifar.ipynb
preview: /lab/cv/deep-vision/02-cnn-cifar.webp
difficulty: 入門
tags: [cv, cnn, cifar, batchnorm]
---

`ml/pytorch` 軌道你在灰階的 MNIST 上跑過 CNN。這課升級到**彩色、更難**的 CIFAR-10,並用上現代 CNN 的標準配備。目標不是衝 SOTA,而是讓你看到一個「像樣的」CNN 怎麼組、怎麼在真實彩色資料上學起來。

## 現代 CNN 的標準三件配備

> - **Conv → BatchNorm → ReLU 堆疊**:BatchNorm 讓每層輸入分布穩定,訓練更快更穩。
> - **MaxPool 降尺寸**:每個區塊把空間尺寸減半(32→16→8→4),濃縮特徵、擴大感受野。
> - **Dropout**:全連接層前隨機關掉一部分神經元,對抗過擬合。

## 這堂課你會學到

- 用 `conv_block` 把「兩層 conv + BN + ReLU + pool」模組化,堆成一個三段式 CNN
- 在 CIFAR-10 上跑**標準訓練迴圈**(約 6 個 epoch,T4 幾分鐘)
- 評估測試準確率,理解純手刻 CNN 的天花板在哪

## 為什麼還要手刻一遍?

明明下一課的遷移學習更強,為什麼先手刻?因為**你得先親眼看到「從零訓練」的成本與極限**——資料要多、訓練要久、準確率還卡在某個水準——才會真正體會遷移學習為什麼是業界預設。痛過,才懂捷徑的價值。

> 💡 這課的 CNN 刻意保持簡單好讀。想進階?加深網路、用 residual 連接(就是 ResNet 的核心),準確率還能再往上——但那也正是「不如直接用預訓練 ResNet」的轉折點,銜接下一課。
