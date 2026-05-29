---
title: "非監督式學習：分群與降維"
description: "沒有答案，照樣能找出結構。用 KMeans 自動分群、用 PCA 把高維資料壓到 2D 看清楚，見證群集從資料本身浮現。"
track: ml
module: scikit-learn
order: 6
notebook: ml/scikit-learn/06-unsupervised.ipynb
preview: /lab/ml/scikit-learn/06-unsupervised.webp
difficulty: 進階
tags: [scikit-learn, unsupervised, kmeans, pca, clustering]
---

前面每一課都有「答案 `y`」可學。但真實世界常常**沒有標籤**——只有一堆資料，要自己找出結構。這就是**非監督式學習**的舞台。

## 這堂課你會學到

- 用 `KMeans` 把沒有標籤的資料自動分群
- 用「手肘法」挑選分群數 K
- 用 `PCA` 降維，把高維資料視覺化在平面上
- 理解 `explained_variance_ratio_`——每個主成分保留了多少資訊

## 結構會自己浮現

預覽圖把 4 維的鳶尾花用 PCA 壓到 2D，再依 KMeans 的分群上色。神奇的是：KMeans **完全沒看過答案**，分出來的群卻幾乎對應到真實品種。

這就是非監督式學習的魅力——不靠標籤，純粹從特徵的分布找規律。`PCA` 則是它的最佳拍檔：前 2 個主成分就保留了約 96% 的資訊，讓你能把高維資料攤在平面上看清楚，無論是探索資料還是加速後續模型都很有用。

> 👉 在 Colab 裡把 `n_clusters` 改成 2 或 4，看 PCA 圖上的分群怎麼變；再用手肘法驗證 K=3 是不是真的最合適。
