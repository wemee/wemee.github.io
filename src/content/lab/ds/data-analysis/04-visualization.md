---
title: "視覺化說故事 · 讓洞見一眼就懂"
description: "數字不會說故事，圖會。用 seaborn 把 EDA 的發現畫成圖——一行畫出帶統計意義的長條圖、分布圖、相關熱力圖，讓不懂資料的人也一眼看懂誰比較容易生還。"
track: ds
module: data-analysis
order: 4
notebook: ds/data-analysis/04-visualization.ipynb
preview: /lab/ds/data-analysis/04-visualization.webp
difficulty: 入門
tags: [data-science, seaborn, visualization, storytelling]
---

上一課用數字找出了規律,但**數字不會說故事,圖會**。這課把 EDA 的發現畫成圖——一張好圖,能讓不懂資料的人也一眼看懂「誰比較容易生還」。

## seaborn:為資料分析而生的繪圖庫

這課呼應 `python/matplotlib` 軌道,但改用 **seaborn**:它建在 matplotlib 之上,**一行就能畫出帶統計意義的圖**(自動分組、算平均、畫誤差棒、配色),特別適合 EDA 的快節奏探索。

## 這堂課你會學到

- **`barplot`**:分組長條圖,自動算每組平均並畫誤差棒(生還率 by 性別/艙等)
- **`histplot`**:分布圖,疊看生還與罹難者的年齡差異(小孩是否較易生還?)
- **`heatmap`**:把相關矩陣畫成熱力圖,紅藍深淺一眼看完所有數值關聯
- 用視覺化把 EDA 的數字**變成一眼就懂的故事**

## 視覺化是溝通的最後一哩

再厲害的分析,如果別人看不懂,影響力就是零。資料科學家有一半的價值在於**把發現講清楚**——而圖表是最有力的語言。一張對的圖勝過一頁數字表格,能讓決策者在三秒內抓到重點。

## 探索用圖 vs 溝通用圖

EDA 階段的圖求**快**(快速畫、快速看、快速丟),seaborn 預設就很夠用;但要放進報告、給老闆看的「溝通用圖」,則要回到 `python/matplotlib` 軌道學的精修:標題、標註、配色、中文字型,一個都不能省。

> 💡 本課圖內標籤用英文,讓 notebook 在 Colab 一鍵就能跑、免裝中文字型。要在圖裡放中文,設定方法見 `python/matplotlib` 第 06 課。下一課,把原始欄位加工成模型更好用的特徵。
