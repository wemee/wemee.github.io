---
title: "把一條線畫到好看：顏色、線型、標記、圖例"
description: "用四個參數控制線的外觀，畫多條線並加上圖例與格線，讓折線圖不只是能看，而是清楚好讀。"
track: python
module: matplotlib
order: 2
notebook: python/matplotlib/02-line-styles.ipynb
preview: /lab/python/matplotlib/02-line-styles.webp
difficulty: 入門
tags: [matplotlib, line, color, legend]
---

掌握了 `fig, ax` 的節奏之後，這課專心把折線畫好看。重點是四個外觀參數，加上多線圖必備的圖例。

## 這堂課你會學到

- 控制線的**顏色**、**粗細**、**線型**、**標記**
- 一張圖畫**多條線**，用**圖例**區分
- 加**格線**與軸標籤讓圖能被讀懂

## 四個外觀參數

```python
ax.plot(x, y,
        color="tab:blue",   # 顏色：推薦用 tab: 系列，整組搭起來好看
        linewidth=2.5,       # 線粗
        linestyle="--",     # 線型：- 實線 / -- 虛線 / : 點線 / -. 點劃線
        marker="o")          # 資料點：o 圓 / s 方 / ^ 三角
```

顏色三種寫法：名稱（`"crimson"`）、十六進位（`"#1f77b4"`）、預設色盤（`"tab:blue"`）。新手直接用 `tab:` 系列最不會出錯。

## 多條線 + 圖例

每條線給一個 `label`，最後呼叫一次 `ax.legend()`，matplotlib 就會自動產生圖例：

```python
ax.plot(x, np.sin(x), label="sin(x)")
ax.plot(x, np.cos(x), label="cos(x)")
ax.legend(loc="best")        # best 讓 matplotlib 自己挑空位
ax.grid(True, alpha=0.3)     # 淡格線幫助讀值
```

> 👉 點上面的「在 Google Colab 開啟」，把每個參數親手改一遍——改顏色、改線型、調 `alpha` 透明度，即時看到差別，比死記參數表快得多。
