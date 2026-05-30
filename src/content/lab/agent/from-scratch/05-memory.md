---
title: "記憶與狀態管理"
description: "Agent 預設是金魚腦——每次呼叫都從零開始。這課給它記憶：跨回合保留對話、用 scratchpad 記下中間結果，並在 context window 快爆時自動摘要壓縮。讓 agent 記得住、撐得久。"
track: agent
module: from-scratch
order: 5
notebook: agent/from-scratch/05-memory.ipynb
preview: /lab/agent/from-scratch/05-memory.webp
difficulty: 進階
tags: [agent, memory, context, state]
---

到目前為止,我們的 agent 是**金魚腦**:每問一個問題就開一段全新對話,答完即忘。你跟它說「我叫小明」,下一句問「我叫什麼」,它完全不記得。這課給它記憶。

## 三種記憶

- **短期記憶(對話歷史)**:把每一回合的 user / assistant 訊息**累積在一個 list** 裡,每次呼叫模型都把整段歷史帶上。這樣 agent 就記得前面說過什麼。最簡單、最重要。
- **Scratchpad(工作記憶)**:ReAct 迴圈裡的 Thought / Action / Observation,本質上就是 agent 解一個任務時的「草稿紙」。把它結構化保存,agent 才能在多步任務裡記得「我已經查過什麼、算到哪」。
- **長期記憶(摘要)**:對話一長,訊息就會撐爆模型的 **context window**(Qwen 有 token 上限)。解法是:當歷史太長,就**請模型自己把舊對話摘要成幾句**,用摘要取代逐字歷史,騰出空間。

## Context Window 是有限的

LLM 一次能讀的 token 有上限。對話越滾越長,遲早會超過上限——超過就直接報錯,或更隱蔽地「把最舊的內容默默截掉」,讓 agent 突然失憶。所以**主動管理 context** 是必修:

> 當 token 估計接近上限時,把最舊的 N 回合對話交給模型摘要成一段話,用這段摘要替換掉那些逐字訊息。新近的對話保留逐字、久遠的壓成摘要——這正是長對話 agent 撐得久的祕訣。

## 這堂課你會學到

- 寫一個 `Memory` 類別:`add()` 累積訊息、組裝成模型的 messages
- 用 **scratchpad** 在多步任務裡保留中間結果
- 做一個**多回合對話 demo**:agent 記得你前面講過的事實
- 實作**自動摘要壓縮**:歷史太長時請模型摘要,用摘要換掉逐字歷史

## 記得住,才撐得久

預覽圖把 context 畫成一條**有限長度的軌道**:左邊是越堆越多的逐字對話,快要撞到右邊「context 上限」的牆時,一段舊對話被**壓縮成一塊小小的摘要方塊**,騰出空間讓新對話繼續進來。這張圖就是這課的核心:**有限的 context + 主動的摘要 = 撐得久的 agent。**

> 👉 在 Colab 裡把摘要觸發的門檻調很低(例如超過 4 回合就摘要),刻意聊長一點,觀察 agent 摘要前後還記不記得最早講的事——體會「摘要會遺失細節」的取捨。
