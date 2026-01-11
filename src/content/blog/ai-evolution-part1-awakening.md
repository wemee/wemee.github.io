---
title: "[AI 演進史 Part 1] 從 SVM 到 AlphaGo：我的 AI 覺醒之路"
pubDate: 2026-01-11
description: "回顧 20 年前的 AI 研究，從 SVM 機器人導航到 CNN 解決不可思議的「貓狗大戰」，以及 AlphaGo帶來的震撼。"
author: "wemee"
image: "/images/blog/ai-evolution-part1-awakening.png"
tags: ["AI", "SVM", "CNN", "AlphaGo", "Deep Learning", "機器學習", "回憶錄"]
---

看著 AI 這幾年的迭代發展，心中總有一種「大江東去，浪淘盡，千古風流人物」的感慨。

這是一段橫跨 20 年的技術旅程。從最早期的數學模型，到深度學習的爆發，再到如今生成式 AI 滿街跑的盛況。我想分幾篇文章，紀錄一下我這個傳統開發者，是如何在一次又一次的技術浪潮中被震撼、被顛覆，然後重新學習的歷程。

## 古代兵器：SVM 與機器人尋路

將時間撥回大約 20 年前，那時我還在念碩士。

當時所謂的「人工智慧」，在我們眼裡其實更像是一種「高深的統計學」。那時候最紅、最潮的技術叫做 **SVM (Support Vector Machine，支援向量機)**。

如果你現在問大學生 SVM 是什麼，他們可能會說是用來做簡單分類的古典算法。但在當年，那可是「屠龍刀」等級的神器。

我記得當時實驗室有同學在做機器人尋路 (Pathfinding)。他的報告讓我印象深刻：
「只要把空間中的障礙物和可行走區域轉化為數據點，SVM 就能在這些點之間找到一個『最佳超平面 (Hyperplane)』，把障礙物和路徑漂亮地分開。」

SVM 的原理很優雅：**找空間中的最佳分隔線**。
這對當時的我來說很有說服力。它邏輯嚴謹，數學證明完美。雖然它能做的事情有限（主要就是分類和回歸），但它讓我第一次感覺到，電腦可以透過數學，「理解」空間的結構。

<img src="/images/blog/part1/svm.png" alt="SVM Hyperplane Visualization" class="img-fluid rounded mb-4 shadow" />

## 第一次衝擊：不可能的貓狗大戰

畢業後工作了幾年，某天突然聽到一個消息：**「只要丟照片給電腦，它就能分得出哪張是貓，哪張是狗。」**

身為一個傳統程式開發者，我的第一個反應是：「聽你在放屁。」(Bullshit)

為什麼我會這麼說？因為在傳統的程式邏輯裡（Rule-based），你要教電腦認東⻄，你必須寫出規則：
*   if (有尖耳朵) and (有鬍鬚) and (瞳孔會變細) -> 這是貓
*   if (體型較大) and (舌頭伸出來) -> 這是狗

但這邏輯充滿漏洞：老虎也有尖耳朵和鬍鬚啊？蘇格蘭折耳貓沒有尖耳朵啊？吉娃娃比貓還小啊？
規則寫不完的。所以我們一直認為，**電腦不可能擁有「視覺認知」**。

結果，**CNN (Convolutional Neural Network，卷積神經網路)** 出現了。

它完全顛覆了我的世界觀。它不需要我們告訴它「什麼是貓的特徵」，它透過一層一層的卷積 (Convolution) 和池化 (Pooling)，自己去「學」會了什麼是邊緣、什麼是紋理、什麼是貓的形狀。

這是我人生中第一次對 AI 感到「敬畏」。它做到了一件我認為邏輯上不可能的事情。

<img src="/images/blog/part1/cnn.png" alt="Traditional Coding vs Deep Learning" class="img-fluid rounded mb-4 shadow" />

## 王者的誕生：AlphaGo

如果說 CNN 只是讓我驚訝，那 **AlphaGo** 就是讓全世界恐慌了。

圍棋 (Go) 一直被認為是 AI 無法攻克的最後堡壘。因為它的變化總數比宇宙中的原子還要多，你不可能用暴力搜尋 (Brute Force) 算完。大家原本預測 AI 要贏人類棋王，起碼還要 20 年。

結果 AlphaGo 橫空出世，以 4:1 痛宰李世石。

我看著直播，心裡發毛。這不只是運算速度快而已，AlphaGo 展示了一種我們無法理解的「直覺」。
*   **Policy Network (策略網路)**：決定下一手該走哪裡（直覺）。
*   **Value Network (價值網路)**：判斷目前局勢是贏是輸（大局觀）。
*   **MCTS (蒙地卡羅樹搜尋)**：在關鍵時刻進行深度計算（算力）。

這三個東西結合在一起，AlphaGo 統治了世界。

<img src="/images/blog/part1/alphago.png" alt="AlphaGo Mind" class="img-fluid rounded mb-4 shadow" />

## 埋頭苦幹：類神經網路的戰國時代

受到 AlphaGo 的刺激，我決定不能被時代拋棄。我也一頭栽進了 Deep Learning 的大坑。

那真是一個百家爭鳴的戰國時代，每天都有新名詞冒出來：
*   **CNN (Inception, ResNet, YOLO)**：各種影像辨識模型殺得昏天暗地。
*   **RNN (Recurrent Neural Network)**：為了讓 AI 看懂文章、聽懂語音，我們引入了「記憶」。
*   **LSTM / GRU**：解決了 RNN 金魚腦（梯度消失）的問題，讓 AI 能記得長篇大論。
*   **Reinforcement Learning (RL)**：強化學習更是分成了 Value-based (如 DQN) 和 Policy-based (如 PPO, A3C) 兩大派系，看著 AI 在模擬環境裡跌跌撞撞學會走路，真的很有趣。

那幾年，我覺得自己掌握了未來的鑰匙。我覺得 AI 就是這樣了：**輸入數據 -> 訓練模型 -> 得到預測/分類結果**。

我們那時候以為，這就是 AI 的終極型態了。它很聰明，但它只是一個「超級分類器」。它能分辨貓狗，能下棋，但它不懂什麼是「創造」。

直到... 下一個怪物出現了。

---

**(下集待續：AI 演進史 Part 2 - 視覺的爆發：從 GAN 到 Stable Diffusion)**
