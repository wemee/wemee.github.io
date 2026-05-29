---
title: "scikit-learn 的世界觀"
description: "幾十種模型長一個樣子——學會 fit / predict / transform 這套節奏，你換任何模型都不用重學。先把這個統一的世界觀建好。"
track: ml
module: scikit-learn
order: 1
notebook: ml/scikit-learn/01-worldview.ipynb
preview: /lab/ml/scikit-learn/01-worldview.webp
difficulty: 入門
tags: [scikit-learn, estimator, iris, train-test-split, KNN]
---

學機器學習，很多人一頭栽進演算法細節，結果換個模型又從頭學一次。scikit-learn 最聰明的設計是：**所有模型都長一個樣子**。這堂課先不急著講演算法，而是把這套**統一的 API** 建立起來——之後每一課都是在這個骨架上長出來的。

## 這堂課你會學到

- sklearn 統一的 **estimator API**：`fit`（訓練）/ `predict`（預測）/ `transform`（轉換）
- 特徵叫 `X`、答案叫 `y` 的不成文慣例
- 為什麼一定要切 **訓練集 / 測試集**——不能拿考過的題目評估學生
- 用鳶尾花資料集跑出你的第一個分類器（KNN）
- 分清楚 **監督式** 與 **非監督式** 學習

## 核心節奏

```python
model = SomeEstimator(...)   # 換模型只改這行
model.fit(X_train, y_train)  # 訓練
model.predict(X_test)        # 預測
model.score(X_test, y_test)  # 評估
```

抓住這四步，你就掌握了整個 sklearn。換模型時只有第一行要改，其餘完全不動——這就是「API 一致、知識可遷移」的威力，也是本系列反覆強調的主線。

> 👉 點上面的「在 Google Colab 開啟」，跟著 notebook 一格一格跑。改改 `n_neighbors`、換個模型，即時看結果——這才是學機器學習最快的方式。
