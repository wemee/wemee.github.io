---
title: "圖型動物園：散佈、長條、直方、箱型"
description: "scatter、bar、hist、boxplot 各自適合回答什麼問題？建立「看到資料就知道選哪種圖」的直覺——選錯圖型再漂亮也會誤導人。"
track: python
module: matplotlib
order: 3
notebook: python/matplotlib/03-plot-zoo.ipynb
preview: /lab/python/matplotlib/03-plot-zoo.webp
difficulty: 入門
tags: [matplotlib, scatter, bar, histogram, boxplot]
---

折線圖只是開始。這課的重點不是「怎麼畫」，而是**什麼資料該用哪一種圖**。

## 這堂課你會學到

- `scatter` 看兩個變數的**關係**
- `bar` 比較**類別**之間的數量
- `hist` 看單一變數的**分布**
- `boxplot` 看資料的**離散程度與離群值**

## 該用哪種圖？

| 你想問的問題 | 用這個 |
| --- | --- |
| 兩個數值變數有沒有關係 | `scatter` |
| 不同類別誰多誰少 | `bar` |
| 一個變數怎麼分布 | `hist` |
| 幾組資料的分散 / 離群比較 | `boxplot` |
| 隨時間的變化趨勢 | `plot`（折線） |

最容易搞混的是 `bar` 和 `hist`：**長條圖的 x 軸是類別**（Python、Go、Rust…），**直方圖的 x 軸是連續數值被切成的區間**。問題不同，圖也不同。

## 一個重要提醒

圓餅圖 `pie` 能少用就少用——人眼比較「角度」遠不如比較「長度」，同樣的資料用長條圖幾乎都更清楚。

> 👉 在 Colab 裡，試著把同一份成績資料同時用 `hist` 和 `boxplot` 畫出來，感受兩者各自告訴你什麼；再把直方圖的 `bins` 數量調大調小，看判讀怎麼改變。
