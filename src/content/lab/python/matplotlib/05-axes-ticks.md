---
title: "座標軸・刻度・標註"
description: "對數尺度呈現跨數量級的資料、twinx 雙 y 軸、自訂刻度位置與標籤、用 annotate 畫箭頭把目光帶到重點。"
track: python
module: matplotlib
order: 5
notebook: python/matplotlib/05-axes-ticks.ipynb
preview: /lab/python/matplotlib/05-axes-ticks.webp
difficulty: 進階
tags: [matplotlib, axis, log-scale, annotate, ticks]
---

資料畫對了，接下來是「讓人一眼讀懂」。這課處理座標軸的細節。

## 這堂課你會學到

- **對數尺度**呈現跨好幾個數量級的資料
- `twinx()` 在同一張圖放**兩種不同單位**的資料
- 自訂 x 軸**刻度位置與標籤**
- `annotate` 畫箭頭、加文字標重點

## 對數尺度

指數成長的資料用線性軸會「貼地又爆衝」，早期變化全看不到。一行改成對數軸，指數成長就變成一條直線：

```python
ax.set_yscale("log")
```

## 雙 y 軸

兩組資料單位不同（溫度 vs 降雨量）時，用 `twinx()` 建立共用 x 軸的第二條 y 軸。**務必把兩條 y 軸的標籤分別上色**，否則讀者分不清哪條線對應哪個軸：

```python
ax2 = ax1.twinx()
ax1.set_ylabel("Temperature", color="tab:red")
ax2.set_ylabel("Rainfall", color="tab:blue")
```

## 標註重點

```python
ax.annotate("peak",
            xy=(px, py),                 # 箭頭指向的點
            xytext=(px + 2, py + 0.1),   # 文字位置
            arrowprops=dict(arrowstyle="->", color="crimson"))
```

> 👉 在 Colab 裡找一組「世界人口隨年份」的資料，分別用線性與對數 y 軸畫出來，親眼比較哪個更能看出早期趨勢。
