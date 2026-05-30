---
title: "Tool Calling 的本質"
description: "「模型呼叫工具」聽起來很神奇，拆穿了其實是：模型吐出一段結構化文字，我們自己解析、執行 Python 函式、把結果餵回去。沒有魔法，沒有框架——你親手寫這四步。"
track: agent
module: from-scratch
order: 2
notebook: agent/from-scratch/02-tool-calling.ipynb
preview: /lab/agent/from-scratch/02-tool-calling.webp
difficulty: 入門
tags: [agent, tool-calling, function-calling, qwen]
---

上一課模型卡在「現在幾點」。這課我們給它一支時鐘。

「模型會呼叫工具」聽起來很玄,好像模型自己伸手去執行程式。**完全不是。** 模型永遠只會做一件事:吐文字。所謂 tool calling,拆穿了就是四個步驟,而且**每一步都是我們寫的**。

## Tool Calling 的四步

1. **描述工具**:在 system prompt 裡告訴模型「你有哪些工具、怎麼呼叫」,並約定一個輸出格式(例如 `<tool_call>{"name": ..., "arguments": {...}}</tool_call>`)。
2. **模型吐出結構化文字**:模型判斷需要工具時,就照約定吐出那段 JSON。它**沒有**真的執行任何東西——只是吐字。
3. **我們解析 + 執行**:用 regex / `json.loads` 把那段文字解析出來,在 **Python 這邊**真的去呼叫對應的函式,拿到結果。
4. **把結果餵回去**:把工具的回傳值塞進對話,再請模型根據結果說出最終答案。

整個過程模型碰到的永遠只有文字。**真正碰到時鐘、碰到計算機、碰到世界的,是步驟 3 裡你寫的 Python。** 這就是 tool calling 的全部真相。

## 這堂課你會學到

- 拆穿 tool calling 的魔法:它只是「結構化文字 + 你寫的解析器」
- 定義第一個工具 `get_current_time()`——一支真正的時鐘
- 寫 system prompt 教模型用約定格式呼叫工具
- 親手完成「解析 → 執行 → 餵回」的一輪,讓模型答對「現在幾點」

## 為什麼自己刻、不用內建格式?

Qwen 其實支援 `tokenizer.apply_chat_template(..., tools=[...])` 這種內建的 tool-calling 格式。但這條軌道**刻意手刻**——因為只有自己寫過「約定格式 → 解析 → 執行」,你才真的懂內建格式底下發生什麼事。等你懂了,要換用內建格式或任何框架都只是換個寫法而已。

## 一輪,還不是迴圈

預覽圖是這課的成果流程:**問題 → 模型吐 tool_call → 我們執行 get_current_time → 餵回 → 模型給最終答案**。注意這裡只跑了**一輪、一個工具**。真實任務常常要「算完再查、查完再算」連續好幾步——那需要一個**迴圈**。下一課,我們就把這一輪一般化成 **ReAct 迴圈**。

> 👉 在 Colab 裡試試:把 `get_current_time` 換成 `get_weather`(回傳寫死的假天氣),改 system prompt 的工具描述,看模型會不會正確改呼叫新工具。
