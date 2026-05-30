---
title: "資料科學的流程 · 從問題到結論"
description: "資料科學不只是跑模型——前面的清理與探索才佔大部分時間。這堂課建立完整流程的心智模型，並載入經典的 Titanic 真實資料集，開始回答「什麼樣的乘客比較容易生還」。"
track: ds
module: data-analysis
order: 1
notebook: ds/data-analysis/01-workflow.ipynb
preview: /lab/ds/data-analysis/01-workflow.webp
difficulty: 入門
tags: [data-science, pandas, titanic, eda]
---

歡迎來到 **資料科學 → 資料分析實戰**。

這條軌道是整個程式實驗室的**入門坡道**:不需要懂深度學習,只要會一點 Python,就能跟著用**真實資料**做出有洞見的分析。它銜接 `python/matplotlib`(畫圖)與 `ml/scikit-learn`(建模)——把中間「看懂資料」這段補起來。

## 資料科學的標準流程

> **問問題 → 取得資料 → 清理 → 探索(EDA)→ 視覺化 → 建模 → 溝通結論。**

很多人以為資料科學就是「跑模型」,其實**前面的清理與探索才佔了大部分時間**(業界常說 80%)。這條軌道就照這個流程一課一課走。

## 這堂課你會學到

- 建立資料科學**完整流程**的心智模型
- 用一行載入經典真實資料集 **Titanic**(891 位乘客 × 15 欄)
- 用 `df.info()` 看結構與缺值、`df.describe()` 看數值分布
- 算出**基準線**(整體生還率 ~38%)——後面所有「某群人特別高/低」都要跟它比

## 我們的問題

整條軌道圍繞一個問題:**什麼樣的乘客比較容易生還?能不能預測?** 從這個問題出發,你會親手把原始名單一路變成可交付的結論。

> 👉 這條軌道很親民,只要會基本 Python。建議搭配 `python/matplotlib`(視覺化)與之後的 `ml/scikit-learn`(建模)一起服用。notebook 在 Colab 一鍵跑,免 GPU。
