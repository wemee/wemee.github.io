---
title: "模型評估：別只看準確率"
description: "『準確率 95%』可能是個騙局。學會用交叉驗證估得更穩，用混淆矩陣、precision / recall、ROC / AUC 看清模型真正的能力。"
track: ml
module: scikit-learn
order: 5
notebook: ml/scikit-learn/05-evaluation.ipynb
preview: /lab/ml/scikit-learn/05-evaluation.webp
difficulty: 進階
tags: [scikit-learn, evaluation, cross-validation, confusion-matrix, roc-auc]
---

100 個病人裡只有 5 個生病，模型**全猜沒病**也有 95% 準確率——但它毫無用處。準確率會騙人。這堂課給你一整組更誠實的評估工具。

## 這堂課你會學到

- 用 **交叉驗證（cross-validation）** 得到更可靠、附帶波動範圍的分數
- 讀懂 **混淆矩陣**——錯誤的型態，不只一個總分
- 理解 **precision（喊得準不準）/ recall（抓得全不全）/ F1（兩者平衡）**
- 畫 **ROC 曲線** 並算 **AUC**，跨所有門檻評估模型

## 為什麼需要這麼多指標？

預覽圖左邊的混淆矩陣，揭露的是準確率藏起來的東西：在醫療、詐欺場景，「把生病的誤判成健康」遠比反過來嚴重——這種**錯誤的代價不對稱**，只看一個總分永遠看不到。

右邊的 ROC 曲線則跳脫了「0.5 當門檻」的預設：分類器其實輸出的是機率，把門檻從 0 掃到 1，就能看出模型在各種取捨下的表現，**AUC** 用一個數字總結（越接近 1 越好，0.5 等於亂猜）。

> 👉 在 Colab 裡把分類門檻從 0.5 改成 0.3，看 recall 和 precision 怎麼此消彼長——並想想醫療場景該往哪邊調。
