---
title: "遷移學習 · 站在 ImageNet 的肩上"
description: "從零訓練 CNN 要大量資料與算力。遷移學習拿 ImageNet 預訓練模型，凍結已學會通用視覺特徵的 backbone，只換掉分類頭微調——又快又準，是業界做影像分類的預設起手式。"
track: cv
module: deep-vision
order: 3
notebook: cv/deep-vision/03-transfer-learning.ipynb
preview: /lab/cv/deep-vision/03-transfer-learning.webp
difficulty: 進階
tags: [cv, transfer-learning, resnet, imagenet]
related: ["ml/pytorch/07-transfer-learning"]
---

上一課你體會了從零訓練 CNN 的成本。這課登場的是電腦視覺**最實用的一招**——遷移學習。

## 核心點子

> 拿一個在 **ImageNet**(120 萬張、1000 類)上**預訓練**好的模型,它的前面幾層已經學會了通用的視覺特徵(邊緣、紋理、形狀)。我們**凍結這些層、只換掉最後的分類頭**,用少量自己的資料微調——又快又準。

打個比方:預訓練模型像一個已經「看過幾百萬張圖、懂得怎麼看圖」的人,你只需要教它「你的這幾類叫什麼名字」,而不是從「什麼是邊緣」開始教起。

## 這堂課你會學到

- 載入預訓練的 **ResNet-18**(`torchvision.models`),連權重一起拿
- `requires_grad = False` **凍結 backbone**,只把最後的 `fc` 換成你的新分類頭
- **只微調那一顆新頭**:因為只訓練一層,收斂超快(2–3 個 epoch 就贏過上一課從零訓練)
- 對照準確率,親眼看「站在巨人肩上」的威力

## 業界的預設起手式

真實專案中,**很少人從零訓練視覺模型**。資料有限、時間有限,遷移學習幾乎總是更好的起點。理解凍結 / 微調 / 換頭這套操作,你就掌握了電腦視覺工程最高頻的工作流。

> 💡 進階玩法:先只訓練新頭暖身,再**解凍後面幾層、用更小的學習率**一起微調(full fine-tuning),通常還能再榨出幾個百分點。`timm` 套件提供上百個更強的預訓練模型可換著玩。
