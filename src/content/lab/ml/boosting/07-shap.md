---
title: "SHAP：解釋每一個預測"
description: "feature_importances_ 只說得出『整體哪些特徵重要』，說不出方向、也無法解釋單筆預測。SHAP 補上這塊，是模型解釋的黃金標準。"
track: ml
module: boosting
order: 7
notebook: ml/boosting/07-shap.ipynb
preview: /lab/ml/boosting/07-shap.webp
difficulty: 進階
tags: [shap, interpretability, xgboost, explainability]
related: ["cv/deep-vision/07-grad-cam"]
---

內建的 `feature_importances_` 只告訴你「整體哪些特徵重要」,但說不出**方向**,也無法解釋**單一一筆預測**為什麼是這個結果。**SHAP** 補上這塊——它是目前模型解釋的黃金標準。

## 這堂課你會學到

- 內建特徵重要性的侷限
- 用 `shap.TreeExplainer` 算出 SHAP values
- 讀 **beeswarm 摘要圖**(全域)與**單筆解釋**(局部)

## 比長條圖多了「方向」

預覽圖就是 SHAP 的 **beeswarm 摘要圖**:每個點是「一筆樣本的一個特徵」,橫軸是它把預測往哪推、推多少,顏色是特徵值的高低。

比起長條圖,它多了關鍵的**方向**資訊——例如「某特徵值越大(紅)越把預測推向某一類」這種洞察,內建 importance 完全給不了。

SHAP 還能把**單一一筆**預測拆解成「從基準值出發,每個特徵各推了多少」。這在要對個案交代理由時(為什麼這位病人被判為高風險)極有價值——模型不再是黑盒。

> 👉 在 Colab 裡挑一筆模型預測錯的樣本,用單筆 SHAP 看它被哪些特徵帶偏。
