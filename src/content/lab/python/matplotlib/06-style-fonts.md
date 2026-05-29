---
title: "樣式與美學：style、rcParams、colormap、中文字型"
description: "套用內建 style sheet、用 rcParams 設全域預設、用 colormap 為連續數值上色，並一次解決 matplotlib 中文顯示成豆腐 □□□ 的經典問題。"
track: python
module: matplotlib
order: 6
notebook: python/matplotlib/06-style-fonts.ipynb
preview: /lab/python/matplotlib/06-style-fonts.webp
difficulty: 進階
tags: [matplotlib, style, rcParams, colormap, 中文字型]
---

最後一課，把圖從「能看」升級到「好看又專業」——並解決華語使用者一定會踩到的中文字型坑。

## 這堂課你會學到

- 一行套用內建 **style sheet** 改變整體風格
- 用 **rcParams** 設全域預設
- 用 **colormap** 為連續數值上色
- 解決 matplotlib 的**中文字型**問題

## 一行換風格

```python
with plt.style.context("ggplot"):   # with 區塊內套用，離開即恢復，不污染其他圖
    fig, ax = plt.subplots()
    ...
```

可選的還有 `seaborn-v0_8`、`bmh`、`fivethirtyeight`、`dark_background`，用 `plt.style.available` 看全部。

## 全域預設 rcParams

```python
plt.rcParams["axes.grid"] = True       # 之後每張圖都套用
plt.rcParams["lines.linewidth"] = 2.2
```

## 中文字型：解決豆腐 □□□

matplotlib 預設字型沒有中文字。解法是指定一個含中文的字型：

```python
# Colab 先安裝（只需一次）：
# !apt-get -qq install fonts-noto-cjk

import matplotlib
matplotlib.rcParams["font.sans-serif"] = ["Noto Sans CJK TC"]  # macOS 可用 "PingFang TC"
matplotlib.rcParams["axes.unicode_minus"] = False               # 否則負號也會變方塊
```

兩個地雷：**`axes.unicode_minus = False` 一定要設**；設了還是方塊通常是字型名稱拼錯，或 Colab 忘了先 `apt-get install`。上面的預覽圖就是設好中文字型後的成果。

> 🎉 走完這六課，你已經能畫出清楚、專業、會說中文的圖了。
>
> 👉 進 Colab 挑一套喜歡的 style，配上中文字型，把第 02 課的多線圖重畫成全中文版本。
