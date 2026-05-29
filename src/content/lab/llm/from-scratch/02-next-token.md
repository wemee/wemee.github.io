---
title: "預測下一個字"
description: "LLM 的本質出乎意料地單純：看著前面的文字，預測下一個字。建立這個框架，並訓練一個最陽春的 bigram 基線。"
track: llm
module: from-scratch
order: 2
notebook: llm/from-scratch/02-next-token.ipynb
preview: /lab/llm/from-scratch/02-next-token.webp
difficulty: 入門
tags: [llm, language-model, bigram, sampling]
---

LLM 的本質出乎意料地單純:**看著前面的文字,預測下一個字**。把這件事做到極致,就成了會寫文章的模型。這堂課建立這個框架,並訓練一個最陽春的 **bigram** 模型當基線。

## 這堂課你會學到

- 理解語言模型 = 「給定前文,預測下一個 token」的機率模型
- 用 `get_batch` 切出「輸入 / 目標」訓練樣本
- 訓練一個 bigram 模型並讓它生成文字(雖然很笨)

## 預測下一個字,就是一切

每個位置的「目標」就是它的**下一個字**——把輸入往右挪一格就是答案。預覽圖顯示:給定「春」,模型吐出對「下一個字是誰」的機率分布。

bigram 只看前一個字,所以生成必然不通順——它記不住上下文。但**訓練 → 生成**的骨架已經完整。要讓它變聰明,模型得學會「往前看更多字」,這正是下一課**自注意力**要解決的問題。

> 👉 在 Colab 裡把生成的開頭字換掉,或印出 bigram 學到「春」後面最常接的字,看它抓到了什麼。
