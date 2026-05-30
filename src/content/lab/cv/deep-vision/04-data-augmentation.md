---
title: "資料增強 · 對抗過擬合"
description: "模型在訓練集很準、測試集卻爛掉，就是過擬合。資料增強用隨機裁切、翻轉、調色讓模型每個 epoch 看到同一張圖的不同變體，被迫學到穩健特徵而不是背圖——視覺領域最有效的正則化。"
track: cv
module: deep-vision
order: 4
notebook: cv/deep-vision/04-data-augmentation.ipynb
preview: /lab/cv/deep-vision/04-data-augmentation.webp
difficulty: 進階
tags: [cv, data-augmentation, overfitting, regularization]
related: ["ml/pytorch/05-regularization"]
---

模型在訓練集上很準、在測試集上卻爛掉——這就是**過擬合**:它把訓練圖「背」起來了,而不是學到通則。視覺領域對抗過擬合最有效的武器,就是**資料增強**。

## 核心點子

> 每次訓練時,把影像**隨機**裁切、翻轉、調色一下。模型每個 epoch 看到的都是「同一張圖的不同變體」,等於免費擴增了資料,被迫學到**真正穩健**的特徵,而不是死記某張圖的長相。

一隻貓不管被裁掉一角、左右翻轉、還是調暗一點,都還是貓。逼模型在這些變化下都答對,它學到的就是「貓的本質」,而非「這張貓圖的像素」。

## 這堂課你會學到

- 組一條**增強管線**:`RandomCrop`、`RandomHorizontalFlip`、`ColorJitter`
- 親眼看同一張圖的 **8 個隨機變體**——這正是模型每個 epoch 看到的
- **過擬合的徵兆**:訓練準確率 ≫ 測試準確率,兩者拉開的那道縫
- 一條鐵則:**增強只用於訓練集,測試集保持原樣**(評估才公平)

## 增強是「免費」的正則化

比起蒐集更多真實資料,資料增強幾乎零成本,卻能顯著縮小過擬合的縫。它和上一課的遷移學習是**標準組合**:預訓練模型給你好的起點,資料增強讓你不會在小資料上過擬合。兩者搭起來,就是業界訓練視覺模型的日常配方。

> 💡 進階增強(Mixup、CutMix、RandAugment、AutoAugment)效果更猛,`torchvision.transforms` 多半已內建。但小心別增強過頭——把貓轉到認不出來,反而會傷害學習。
