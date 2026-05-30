---
title: "入門：figure / axes 心智模型"
description: "搞懂 matplotlib 畫圖時到底是誰在畫、畫在哪裡。建立 Figure 與 Axes 的正確心智模型，後面所有功能你都能自己推出來。"
track: python
module: matplotlib
order: 1
notebook: python/matplotlib/01-basics.ipynb
preview: /lab/python/matplotlib/01-basics.webp
difficulty: 入門
tags: [matplotlib, figure, axes, subplots]
related: ["ds/data-analysis/04-visualization"]
---

很多人學 matplotlib 是用「複製貼上、能跑就好」的方式，結果圖一變複雜就完全失控。這堂課反過來——先花十分鐘把**心智模型**建好，之後你不用背 API，也能推得出該怎麼畫。

## 這堂課你會學到

- 分清楚 **Figure（畫布）** 與 **Axes（座標系）** 的差別
- 用 `plt.subplots()` 一次拿到這兩個物件
- 理解 **物件導向 (OO) 寫法** 與 **pyplot 寫法** 的差異，知道為什麼推薦前者
- 畫出你的第一張折線圖，並切出多個子圖

## 核心觀念：Figure vs Axes

matplotlib 的圖由兩層組成，這是整個函式庫的地基：

- **Figure（畫布）**：最外層的容器，整張圖。一個 Figure 可以裝很多個 Axes。
- **Axes（座標系）**：真正畫資料的地方——有 x 軸、y 軸、刻度、標題。一個「子圖」就是一個 Axes。

用畫畫比喻：**Figure 是整張畫紙，Axes 是你在紙上框出來、實際作畫的那一格**。上面的預覽圖就是「一張 Figure、兩個 Axes」最直接的樣子。

## 核心節奏

```python
fig, ax = plt.subplots()   # 1. 拿到畫布與座標系
ax.plot(x, y)              # 2. 在座標系上畫資料
ax.set_title("標題")        # 3. 設定這個座標系
plt.show()                 # 4. 顯示
```

抓住這個四步節奏，你就掌握了 matplotlib 的核心。本系列一律用這種 **OO 寫法**（對著 `ax` 下指令），而不是隱藏狀態的 `plt.plot()` pyplot 寫法——因為圖一複雜，明確指定對象才不會亂。這也是官方文件的建議。

> 👉 點上面的「在 Google Colab 開啟」，跟著 notebook 一步步跑、動手改參數。每一格都能即時看到結果，這才是學視覺化最快的方式。
