---
title: "遷移學習"
description: "從零訓練大模型要海量資料與算力。遷移學習讓你站在巨人肩膀上：借用預訓練模型學到的視覺特徵，少少資料就解決自己的任務。"
track: ml
module: pytorch
order: 7
notebook: ml/pytorch/07-transfer-learning.ipynb
preview: /lab/ml/pytorch/07-transfer-learning.webp
difficulty: 進階
tags: [pytorch, transfer-learning, resnet, pretrained, fine-tuning]
---

從零訓練一個大模型要海量資料與算力。**遷移學習**讓你站在巨人肩膀上:拿一個在百萬張圖上預訓練好的模型,借用它學到的「視覺特徵」,只花少少資料就解決你自己的任務。

## 這堂課你會學到

- 載入預訓練的 `resnet18`
- 把它當成**凍結的特徵萃取器**
- 在少量資料上,比較「遷移學習」與「從零訓練」

## 站在巨人肩膀上

預覽圖是關鍵實驗:在只有 1000 張的 **CIFAR-10**(自然影像)上,**遷移學習(64%)大勝從零訓練的小 CNN(40%)**。

為什麼?resnet 早就從 ImageNet 百萬張圖學會「邊緣、紋理、形狀」這些通用視覺特徵,不必用你的 1000 張重新學一遍。我們只要凍結它、把它當成「把影像轉成 512 維特徵」的機器,再接一個簡單分類器即可。**資料越少,遷移學習的優勢越大。**

> 進階做法叫 **fine-tuning**:不只訓練新的分類頭,還用很小的學習率微調 resnet 後面幾層,讓特徵更貼合你的任務。

> 👉 在 Colab 裡把訓練資料從 1000 減到 100,看兩種做法的差距會不會拉得更大。
