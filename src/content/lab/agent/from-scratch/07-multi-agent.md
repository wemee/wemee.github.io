---
title: "多代理協作：Planner + Executor"
description: "複雜任務一個 agent 容易迷路。拆成兩個角色：planner 先把任務切成步驟，executor 逐步用工具執行，再彙整成答案。學會編排多次 LLM 呼叫——以及反思(self-reflection)這個近親。"
track: agent
module: from-scratch
order: 7
notebook: agent/from-scratch/07-multi-agent.ipynb
preview: /lab/agent/from-scratch/07-multi-agent.webp
difficulty: 專題
tags: [agent, multi-agent, planner, executor]
---

一個 ReAct agent 解簡單任務很好,但碰到**大而複雜**的任務(「幫我規劃一趟三天兩夜的行程,要算預算又要查天氣」),它常常在中途**迷路**:忘了大局、在細節裡打轉。人類遇到大任務會怎麼做?**先列計畫,再一步步做。** 多代理協作就是把這件事搬給 agent。

## 拆成兩個角色

- **Planner(規劃者)**:只做一件事——把複雜任務**拆解成有序的子步驟**(一份編號清單)。它不執行,只負責「想清楚要做哪些事、什麼順序」。
- **Executor(執行者)**:就是前面幾課做好的 **ReAct 工具 agent**。它一次只專心做**一個**子步驟,用工具把它完成。

外層一個 **orchestrator(編排器)** 把流程串起來:拿 planner 的計畫,**逐步交給 executor**,把每步的結果累積起來,最後**彙整成完整答案**。

> 為什麼有效?因為**分工降低了每個 agent 的認知負擔**。planner 不用管工具細節,只想大局;executor 不用管全局,只專心做好眼前這一步。兩個簡單角色,合作解決一個單一 agent 扛不動的任務。

## 這堂課你會學到

- 理解「**先規劃、再執行**」為什麼能解單一 agent 扛不動的複雜任務
- 寫一個 **planner**:把任務拆成有序子步驟清單
- 把前幾課的 ReAct agent 當 **executor**,逐步執行
- 寫 **orchestrator** 串起流程、累積中間結果、彙整最終答案
- (sidebar)認識近親 **reflection**:讓 agent **自我批評再修正**

## 近親:Reflection(反思)

多代理還有一個常見變體值得認識:**reflection**。不是拆成兩個角色平行分工,而是讓**同一個 agent 先產出答案,再扮演「批評者」檢查自己的答案哪裡不好,然後根據批評修正**。一寫一改、自我迭代。planner+executor 是「分工」,reflection 是「自我審稿」——課程主線做前者,sidebar 帶你看後者怎麼用幾行接上去。

## 一張任務分解圖

預覽圖把這課畫成**一棵分解樹**:頂端是一個複雜任務,planner 把它拆成三個編號子步驟,每個子步驟下面接一個小小的 executor(ReAct 迴圈)去完成,最後三條結果匯流到底部,彙整成最終答案。這張圖就是多代理的精神:**一個負責拆、一個負責做、一個負責合。**

> 👉 在 Colab 裡把同一個複雜任務,分別丟給「單一 ReAct agent」和「planner+executor」,比較兩者的答案品質與穩定度——體會分工的價值。
