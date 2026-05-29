---
title: "子圖與版面：subplots 與 GridSpec"
description: "一張 Figure 裝多個 Axes。用 subplots 切規則網格、sharex/sharey 共用軸、GridSpec 做不等大小版面，並用 constrained_layout 自動排好間距。"
track: python
module: matplotlib
order: 4
notebook: python/matplotlib/04-subplots.ipynb
preview: /lab/python/matplotlib/04-subplots.webp
difficulty: 進階
tags: [matplotlib, subplots, gridspec, layout]
---

回到第 01 課的心智模型——**一張 Figure 可以裝很多個 Axes**。這課把多個 Axes 排得整齊好看。

## 這堂課你會學到

- `plt.subplots(列, 欄)` 切出規則的子圖網格
- `sharex` / `sharey` 共用座標軸
- `GridSpec` 做**不等大小**的版面
- `constrained_layout` 自動排間距，告別重疊

## 規則網格

```python
fig, axes = plt.subplots(2, 2, constrained_layout=True)
for ax in axes.flat:        # .flat 把 2D 陣列攤平，方便逐格處理
    ax.plot(...)
```

`axes` 是一個陣列，`axes[列][欄]` 取出每一格；`fig.suptitle()` 設整張圖的大標題。

## 不等大小：GridSpec

當你要「上面一張寬圖、下面兩張小圖」這種版面，規則網格不夠用，改用 GridSpec：

```python
gs = fig.add_gridspec(2, 2)
ax_top = fig.add_subplot(gs[0, :])   # 第 0 列、跨所有欄 → 一張寬圖
ax_bl  = fig.add_subplot(gs[1, 0])   # 第 1 列左
ax_br  = fig.add_subplot(gs[1, 1])   # 第 1 列右
```

`gs[0, :]` 的 `:` 代表「整列所有欄」。儀表板式的版面就是這樣拼出來的。

> 💡 養成加 `constrained_layout=True` 的習慣——它會自動調整子圖間距，省掉標題與軸標籤互相重疊的麻煩。
>
> 👉 進 Colab 動手拼一個「左大圖 + 右側上下兩小圖」的儀表板版面。
