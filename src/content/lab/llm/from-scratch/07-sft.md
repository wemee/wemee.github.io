---
title: "對齊 ①：SFT 監督式微調"
description: "從『只會接字』到『會照指令回答』。用一堆指令→理想回應的配對繼續訓練模型——對齊的第一步。"
track: llm
module: from-scratch
order: 7
notebook: llm/from-scratch/07-sft.ipynb
preview: /lab/llm/from-scratch/07-sft.webp
difficulty: 專題
tags: [llm, sft, fine-tuning, alignment, instruction-tuning]
---

到上一課為止,我們的 GPT 只會「接字」——你給開頭,它接著胡謅。但 ChatGPT 會**照你的指令回答**。從「會接字」到「會照指令回答」的第一步,就是 **SFT(Supervised Fine-Tuning,監督式微調)**:拿一堆「指令 → 理想回應」的配對,繼續訓練模型。

## 這堂課你會學到

- 理解 base 模型(只會接字)與對齊後模型(會照指令回答)的差別
- 準備「指令 → 回應」資料集
- 對 base 模型做 SFT,看它學會照格式回答

## 從胡謅到聽懂指令

預覽圖就是 SFT 的威力:同一個提示「問:3加4等於 答:」——

- **Base 模型**:只會接字,答非所問(「盡,唯見長江…」)
- **SFT 之後**:照格式回答「7。」

我們用一個小到能驗證的任務(單位數加法),把 base 模型在「指令→回應」配對上繼續訓練。它就學會了照格式回答,小資料多半答得對。功能很陽春沒關係——重點是你看見了**對齊的第一步**:用配對資料,把一個只會接字的 base 模型,調教成會聽指令做事的模型。真實的 ChatGPT 就是用同樣的 SFT(加上海量、多樣的指令資料)煉成的。

> 👉 在 Colab 裡把任務換成減法或問候語,看 SFT 後它學不學得會。

下一課,用 DPO 做對齊的第二步:對齊**人類偏好**。
