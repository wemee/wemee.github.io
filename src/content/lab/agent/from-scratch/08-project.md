---
title: "實戰專案 · 接軌真實世界"
description: "把前七課全部組起來，做一個迷你研究助理：會查資料、會算數、記得住對話、會規劃多步任務。最後一個選修 sidebar：只改一個函式，就把本地 Qwen 換成 Gemini／Groq 免費 API。整條學習線的終點。"
track: agent
module: from-scratch
order: 8
notebook: agent/from-scratch/08-project.ipynb
preview: /lab/agent/from-scratch/08-project.webp
difficulty: 專題
tags: [agent, project, gemini, groq, capstone]
---

走到這裡,你手上已經有了所有零件:**工具呼叫、ReAct 迴圈、工具路由、記憶、RAG、多代理**。這最後一課,把它們**全部組成一個能用的東西**——並給你一條通往真實世界的橋。

## 專案:迷你研究助理

我們組一個 **「研究助理」agent**,它同時具備:

- **工具箱**:`retrieve`(RAG 查知識庫)+ `calculator`(算數)+ `get_current_time`(時鐘)——第 02、04、06 課的成果。
- **ReAct 迴圈**:多步推理、自己決定用哪支工具——第 03 課。
- **記憶**:跨回合對話,記得你前面問過什麼——第 05 課。
- **(進階)規劃**:複雜問題先 planner 拆步驟再執行——第 07 課。

丟給它一個需要「查 + 算 + 記」綜合起來的問題,看它把所有零件協調起來,給出有依據的答案。這就是一個 agent 從玩具走向**真的能幫上忙**的樣子。

## 選修 sidebar:接軌真實世界(免費 API)

本地 Qwen 1.5B 夠教學,但它畢竟小,tool calling 偶爾會不穩。想體驗「更強模型的 agent 是什麼感覺」,可以接**免費 API**——而且因為我們從第一課就把模型呼叫**包成一個 `chat()` 函式**,要換模型,**只需要改那一個函式**,agent 的其餘程式一行都不用動。這就是好抽象的回報。

- **Gemini 2.5 Flash 免費層**:1,500 req/天、免信用卡、原生支援 function calling。
- **Groq**(Llama 3.3 70B 等):免費層、速度極快、也支援 function calling。

> ⚠️ 每人請**各自申請自己的 free key**(非共用額度),key 用 Colab 的 secrets 或環境變數帶入,**別寫死在 notebook 裡**。換上更強的模型,你會立刻感覺到 tool calling 變穩、多步推理變聰明——但 agent 的骨架,還是你這八課親手刻的那一套。

## 這堂課你會學到

- 把工具、ReAct、記憶、RAG、(選配)規劃**組成一個完整 agent**
- 跑一個需要綜合能力的真實問題,看所有零件協作
- (sidebar)用 `chat()` 抽象,**一鍵把本地 Qwen 換成 Gemini / Groq**,感受差異

## 終點,也是起點

預覽圖把這課畫成一張**完整 agent 的系統圖**:中央是 LLM 引擎,周圍接著記憶、工具箱、RAG 知識庫、規劃器,外圈一條 ReAct 迴圈把它們串起來轉動——這正是你這八課一塊一塊拼起來的全貌。

從 `ml` 的第一個分類器,到 `llm` 從零刻出的迷你 GPT,再到這條軌道**手刻出一個會用工具、會做事的 agent**——你已經走完了「經典 ML → 深度學習 → 從零打造 LLM → AI Agent」整條學習弧線。真實世界的 agent 框架(LangGraph、AutoGen…)只是把你親手寫過的這些零件,做得更工整、更大規模。**底層原理,你已經全部刻過一遍了。**

> 🎓 恭喜走完整條 AI/ML 學習線。下一步,就是拿這套骨架,去打造一個真正解決你自己問題的 agent。
