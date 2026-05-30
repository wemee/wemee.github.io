---
title: "多工具與工具路由"
description: "給 agent 一整個工具箱，讓模型自己選用哪一支。手刻 tool registry，自動把工具描述塞進 prompt，並處理模型幻覺出不存在的工具時的錯誤回復——真實 agent 的健壯性從這裡開始。"
track: agent
module: from-scratch
order: 4
notebook: agent/from-scratch/04-tool-routing.ipynb
preview: /lab/agent/from-scratch/04-tool-routing.webp
difficulty: 進階
tags: [agent, tools, routing, registry]
---

上一課的 ReAct agent 只有兩支寫死的工具。真實 agent 動輒十幾支工具,而且常常要新增——這課把工具系統**升級成一個註冊表(registry)**,並處理「模型亂呼叫」的健壯性問題。

## Tool Registry:工具即資料

與其把每支工具硬寫進 prompt,不如把它們**註冊成資料**:每支工具登記 `name`、`description`、`parameters`(參數說明)、還有實際要跑的 Python 函式。然後:

- **自動產生 prompt**:從 registry 自動把「你有哪些工具、各自怎麼用」組成那段 system prompt——新增工具只要註冊一筆,prompt 自己更新,不用改別的地方。
- **自動路由**:模型吐出 `name` 後,我們用它去 registry 查對應函式來執行。模型負責「選哪支」,registry 負責「對應到哪個函式」。

這就是「**工具路由**」:把模型的選擇,對應到實際的程式呼叫。

## 模型會幻覺,agent 要扛得住

給模型一箱工具,它**一定**會偶爾:

- 呼叫一個**不存在**的工具名稱
- 給**錯誤的參數**(少給、型別錯、亂給)
- 把 JSON **格式吐壞**

健壯的 agent 不能一遇到這些就崩潰。正確做法是**把錯誤當成一種 Observation 餵回去**:「沒有這支工具,你可以用的是 A、B、C」或「參數錯誤:expected X」。模型收到這個觀察後,**通常下一步就會自我修正**。這個「錯誤也是觀察」的設計,是 agent 從 demo 走向能用的關鍵一步。

## 這堂課你會學到

- 設計一個 **tool registry**:name / description / parameters / 函式
- 從 registry **自動生成**工具說明,塞進 ReAct 的 system prompt
- 給 agent 一個工具箱(計算機、時鐘、字數統計、假查詢…),讓它**自己路由**
- 處理三種模型出錯:**幻覺工具名、參數錯誤、JSON 壞掉**,把錯誤當 Observation 餵回讓模型自我修正

## 從「兩支寫死」到「一整箱可擴充」

預覽圖把這課畫成一張**路由圖**:中間是模型,根據問題把箭頭指向工具箱裡不同的工具;其中一條箭頭指向「不存在的工具」,被 registry 攔下、回一個錯誤觀察,模型隨即改指向正確的工具。這張圖就是這課的兩個重點:**可擴充的路由** + **對幻覺的健壯性**。

> 👉 在 Colab 裡故意註冊兩支功能重疊的工具(例如 `add` 和 `calculator` 都能加法),觀察模型怎麼選——這能讓你體會「工具描述寫得好不好」直接影響路由準確度。
