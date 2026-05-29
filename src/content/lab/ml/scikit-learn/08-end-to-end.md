---
title: "完整流程實戰"
description: "把前七課的招式全部串起來，走一遍真實的機器學習流程：理解資料 → 切分 → Pipeline 前處理 → 交叉驗證 → GridSearch 調參 → 測試集驗收 → 解讀結果。"
track: ml
module: scikit-learn
order: 8
notebook: ml/scikit-learn/08-end-to-end.ipynb
preview: /lab/ml/scikit-learn/08-end-to-end.webp
difficulty: 專題
tags: [scikit-learn, pipeline, gridsearch, end-to-end, workflow]
---

學完一身招式，這堂課把它們**串成一條完整的實戰流程**。用乳癌診斷資料集，走一遍資料科學家拿到新資料時該有的工作節奏——這也是整個 scikit-learn 模組的收尾。

## 這堂課你會學到

- 串起完整流程：資料 → Pipeline → 調參 → 評估 → 解讀
- 用 `GridSearchCV` 自動尋找最佳超參數
- 在被藏起來的測試集上做**最終、誠實的**驗收
- 用混淆矩陣與特徵重要性產出結論，而非只丟一個分數

## 機器學習的標準工作流程

把這條流程刻進肌肉記憶，拿到任何資料都能套：

1. **理解資料** —— 形狀、類別分布、有沒有缺值
2. **切分** —— 測試集先藏好，絕不偷看
3. **Pipeline** —— 前處理 + 模型綁成一體，自動防資料洩漏
4. **交叉驗證 + 調參** —— 只在訓練集上用 `GridSearchCV` 找最佳設定
5. **最終驗收** —— 測試集只開封一次，看混淆矩陣 / report / AUC
6. **解讀** —— 用特徵重要性等工具產出洞察

預覽圖就是這條流程的成果：左邊最終混淆矩陣（注意醫療場景中「把惡性誤判成良性」是最危險的錯誤），右邊模型最看重的特徵。

> 👉 在 Colab 裡把 `RandomForestClassifier` 換成 `LogisticRegression`，整條流程不動就能比較模型——最後挑戰用你自己的 CSV 套同一套六步流程。
