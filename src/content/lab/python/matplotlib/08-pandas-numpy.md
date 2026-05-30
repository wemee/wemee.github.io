---
title: "與 pandas / numpy 結合：真實資料的視覺化"
description: "df.plot() 底層就是 matplotlib、回傳 Axes，可繼續客製。groupby 彙總後畫圖，並用 numpy 2D 陣列配 imshow / contourf 畫熱圖與等高線。matplotlib 模組收尾課。"
track: python
module: matplotlib
order: 8
notebook: python/matplotlib/08-pandas-numpy.ipynb
preview: /lab/python/matplotlib/08-pandas-numpy.webp
difficulty: 專題
tags: [matplotlib, pandas, numpy, heatmap, contour]
related: ["ds/data-analysis/01-workflow"]
---

前面七課都用手刻的小資料。真實工作裡，資料幾乎都裝在 **pandas DataFrame** 或 **numpy 陣列**裡。這課把 matplotlib 接上它們——也是入門模組的收尾。

## 這堂課你會學到

- 用 `df.plot()` 一行畫圖，並理解它**底層就是 matplotlib**
- 把 pandas 的便利與 matplotlib 的控制力**結合**
- `groupby` 彙總後畫圖
- 用 numpy 2D 陣列 + `imshow` / `contourf` 畫**熱圖與等高線**

## 關鍵橋樑：df.plot(ax=ax)

`df.plot()` 不是另一套繪圖系統——它底層呼叫的就是 matplotlib，而且**回傳一個 Axes**。所以可以先用 pandas 快速出圖，再接手用前幾課的 `ax.set_xxx()` 客製：

```python
fig, ax = plt.subplots()
df.plot(ax=ax, marker="o")        # pandas 畫到我指定的 ax
ax.set_title("...")               # 接手客製，前幾課學的全能用
ax.grid(True, alpha=0.3)
```

一列一筆的原始資料，先 `groupby` 彙總再畫：

```python
orders.groupby("category")["amount"].sum().plot.bar(ax=ax)
```

## numpy 2D：熱圖與等高線

二維陣列（影像、相關矩陣、地形、機率密度）用兩種圖：

- **`imshow`** — 離散格子，最常見是相關係數矩陣，配 `cmap="coolwarm"` 與 `colorbar`
- **`contourf`** — 連續場，先用 `np.meshgrid` 把一維座標展成網格、算出每點 z 值，再畫填色等高線

```python
X, Y = np.meshgrid(xs, ys)
Z = np.exp(-(X**2 + Y**2) / 2)        # 2D 高斯
ax.contourf(X, Y, Z, levels=20, cmap="viridis")
```

> 🎓 走完這八課，你的視覺化工具箱完整了——從 figure/axes 心智模型，到動畫，再到接上真實資料。
>
> 👉 進 Colab 拿一份真實 CSV（`pd.read_csv`）動手畫畫看，並挑戰在熱圖格子上用 `ax.text()` 標出數值。
