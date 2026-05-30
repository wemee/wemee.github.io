---
title: "手刻 ReAct 迴圈"
description: "Thought → Action → Observation，反覆進行直到收斂——這就是 agent 的靈魂。把上一課的「一輪」一般化成一個會自己多步推理、自己決定何時停的迴圈。整條軌道最核心的一課。"
track: agent
module: from-scratch
order: 3
notebook: agent/from-scratch/03-react-loop.ipynb
preview: /lab/agent/from-scratch/03-react-loop.webp
difficulty: 進階
tags: [agent, react, reasoning, loop]
---

這是整條軌道的**靈魂課**。

上一課的 tool calling 只跑了「問題 → 一個工具 → 答案」一輪。但真實任務常是多步的:「現在到下午三點還有幾小時?」要先**查現在幾點**(工具),再**算時間差**(另一個工具),才能回答。一輪不夠,需要一個**迴圈**。

## ReAct:Reason + Act

**ReAct** 是 agent 最經典的迴圈,把模型的每一步拆成三段:

- **Thought(想)**:模型先用文字想「我現在該做什麼」。
- **Action(做)**:模型決定呼叫哪個工具、給什麼參數。
- **Observation(看)**:我們執行工具,把結果餵回給模型當「觀察」。

然後**回到 Thought**,根據新觀察再想下一步……如此反覆,直到模型覺得「資訊夠了」,就輸出 **Final Answer**。

```
Thought → Action → Observation → Thought → Action → Observation → … → Final Answer
```

這個迴圈就是把一顆只會吐字的 LLM,變成一個**會自己多步推理、自己用工具、自己決定何時停**的 agent 的全部。沒有它,LLM 只是個聊天機器人。

## 這堂課你會學到

- 理解 ReAct 的 **Thought / Action / Observation** 三段節奏
- 把上一課的「一輪」一般化成 `react_agent(question, tools, max_steps)`
- 給模型兩個工具(時鐘 + 計算機),丟一個**需要連續兩步**的問題
- 看完整的推理軌跡(trace),並加上**停止條件與 `max_steps` 上限**防止無限迴圈

## 工程上的兩個必修細節

手刻迴圈一定會踩到這兩點,課程裡會處理:

- **停止條件**:怎麼判斷模型「想結束了」?我們約定模型輸出 `Final Answer:` 開頭就收工,並解析出最終答案。
- **`max_steps` 護欄**:萬一模型鬼打牆、一直呼叫工具不收斂,迴圈要有上限(例如最多 6 步),到頂就強制停,避免燒爆免費額度與時間。

## 一條看得見的推理軌跡

預覽圖是這課的成果:一條**從上往下展開的 ReAct 軌跡**——Thought 想「我得先知道現在幾點」→ Action 呼叫 `get_current_time` → Observation 拿到時間 → Thought 想「現在算到三點的差」→ Action 呼叫 `calculator` → Observation 拿到答案 → Final Answer。整條鏈每一步都是模型自己決定的,而我們只負責在旁邊執行工具、餵回觀察。

> 👉 在 Colab 裡把 `max_steps` 調到 2,丟一個需要三步的問題,看 agent 怎麼「撞到上限被強制停」——這能讓你體會護欄的必要。
