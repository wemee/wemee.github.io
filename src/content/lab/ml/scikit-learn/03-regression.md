---
title: "迴歸：預測連續數值"
description: "從『猜哪一類』換成『預測一個數字』。線性與多項式迴歸、用 MSE / R² 評估、用殘差圖診斷模型有沒有抓住規律。"
track: ml
module: scikit-learn
order: 3
notebook: ml/scikit-learn/03-regression.ipynb
preview: /lab/ml/scikit-learn/03-regression.webp
difficulty: 入門
tags: [scikit-learn, regression, linear-regression, polynomial, metrics]
---

分類是猜「哪一類」，**迴歸** 是預測「一個數字」——房價、氣溫、銷售額。流程跟分類一模一樣（`fit` / `predict`），但評估方式不同，而且多了一個強大的診斷工具：**殘差圖**。

## 這堂課你會學到

- 用 `LinearRegression` 擬合資料，讀懂 `coef_`（斜率）與 `intercept_`（截距）
- 用 **MSE**（越小越好）與 **R²**（越接近 1 越好）評估
- 用 `PolynomialFeatures` 擬合非線性關係——同一個線性模型也能畫曲線
- 用**殘差圖**做模型的健康檢查

## 殘差圖：模型的健康檢查

**殘差 = 真實值 − 預測值**。把殘差對預測值畫散布圖：

- **健康**：殘差隨機散在 0 附近、沒有形狀 → 模型抓住了規律。
- **有問題**：殘差出現曲線、喇叭狀 → 模型漏掉了結構（例如該用非線性卻硬套直線）。

學會看殘差圖，你就不會只憑一個 R² 數字自我感覺良好——它會誠實告訴你模型哪裡沒做好。

> 👉 在 Colab 裡把多項式 `degree` 從 2 一路加到 10，觀察曲線怎麼從「擬合」變成「硬背雜訊」——這就是過擬合的現場。
