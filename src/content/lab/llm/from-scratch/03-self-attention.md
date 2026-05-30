---
title: "自注意力 Self-Attention"
description: "Transformer 的心臟。讓每個位置回頭看前面所有字、自己決定該注意誰。從零實作 Q/K/V 與因果遮罩。"
track: llm
module: from-scratch
order: 3
notebook: llm/from-scratch/03-self-attention.ipynb
preview: /lab/llm/from-scratch/03-self-attention.webp
difficulty: 進階
tags: [llm, self-attention, transformer, qkv, causal-mask]
related: ["diffusion/from-scratch/05-text-conditioning"]
---

bigram 笨在「只看前一個字」。**自注意力**讓每個位置能**回頭看前面所有字**,並自己決定「該注意誰」。這是 Transformer 的心臟,也是整個 LLM 革命的引擎。這堂課從零把單頭注意力刻出來。

## 這堂課你會學到

- 理解自注意力要解決什麼:讓 token 之間互相「溝通」
- 親手實作 **Query / Key / Value** 與縮放點積注意力
- 理解**因果遮罩**:預測時不能偷看未來

## Q / K / V 與不能偷看未來

每個 token 產生三個向量:**Query**(我想找什麼)、**Key**(我有什麼)、**Value**(需要我時我給的內容)。每個位置用自己的 Query 和所有位置的 Key 比對,算出「該多注意誰」,再用權重把大家的 Value 加權平均——這樣每個 token 就吸收了它該關注的上下文。

預覽圖是注意力權重矩陣:**左下三角有值、右上三角全 0**。這是**因果遮罩**——預測第 3 個字時只能看第 1、2、3 個字,絕不能偷看後面的答案。這正是 GPT 能「邊讀邊預測、又不作弊」的關鍵。

> 👉 在 Colab 裡把縮放 `** -0.5` 拿掉,看 softmax 後的權重變得多極端——這就是為什麼要「縮放」點積。
