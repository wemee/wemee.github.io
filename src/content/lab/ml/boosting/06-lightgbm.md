---
title: "LightGBM 與 CatBoost"
description: "XGBoost 不是唯一。LightGBM（微軟）以速度著稱，CatBoost（Yandex）擅長類別特徵。比較它們，知道何時用哪個。"
track: ml
module: boosting
order: 6
notebook: ml/boosting/06-lightgbm.ipynb
preview: /lab/ml/boosting/06-lightgbm.webp
difficulty: 進階
tags: [lightgbm, catboost, xgboost, benchmark]
---

XGBoost 不是 boosting 的唯一選擇。**LightGBM**(微軟)以速度著稱,**CatBoost**(Yandex)擅長類別特徵。三者 API 都跟 sklearn 一致,可以互換試。

## 這堂課你會學到

- 用 `LGBMClassifier` 訓練,體會它的速度
- 理解 LightGBM 的 leaf-wise 生長與 XGBoost 的差異
- 知道 CatBoost 的定位

## level-wise vs leaf-wise

預覽圖是速度對決:同樣的資料與樹數,LightGBM 通常明顯更快、準確率相近——資料越大差距越明顯。差別在樹怎麼長:

- **XGBoost(level-wise)**:一層一層長,整棵樹平衡。
- **LightGBM(leaf-wise)**:每次挑「最能降低 loss 的那片葉子」往下長,成長更有效率 → 更快、常更準,但小資料較容易過擬合(用 `num_leaves`、`min_child_samples` 控制)。

**CatBoost** 的招牌則是原生處理類別特徵——不用自己做 One-Hot,丟字串欄位進去就行。

| 情境 | 建議 |
| --- | --- |
| 通用、生態最成熟 | XGBoost |
| 資料大、要快 | LightGBM |
| 很多類別特徵 | CatBoost |

> 👉 在 Colab 裡把資料量加到 20 萬筆,看 XGBoost 與 LightGBM 的時間差距變多大。
