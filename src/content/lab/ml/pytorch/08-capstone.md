---
title: "完整專案與部署"
description: "在 FashionMNIST 上訓練一個完整 CNN，並學會存檔、載入、部署——讓模型走出 notebook，真正用起來。深度學習模組的收尾。"
track: ml
module: pytorch
order: 8
notebook: ml/pytorch/08-capstone.ipynb
preview: /lab/ml/pytorch/08-capstone.webp
difficulty: 專題
tags: [pytorch, cnn, deployment, onnx, tfjs]
---

把前七課全部串起來,在 **FashionMNIST**(衣服圖片)上訓練一個完整的 CNN 分類器,並學會**存檔、載入、部署**——讓模型走出 notebook,真正用起來。這是深度學習模組的收尾。

## 這堂課你會學到

- 串起完整流程:資料 → CNN(含 dropout)→ 訓練/驗證 → 評估
- 用 `torch.save` / `load_state_dict` 存檔與載入模型
- 認識部署選項(ONNX、TF.js)

## 深度學習的完整流程

1. **資料** → `DataLoader` 分批
2. **模型** → CNN + dropout,搬上 `device`
3. **訓練/評估** → 訓練迴圈 + 逐輪看測試準確率
4. **存檔** → `torch.save(state_dict)`,`load_state_dict` 載回
5. **部署** → ONNX / TF.js / API

預覽圖是 FashionMNIST 的樣本(T 恤、鞋子、包包…),比手寫數字更有挑戰。

特別一提**部署到瀏覽器**:把模型轉成 **TensorFlow.js** 就能直接在網頁上跑、零後端——本站 `/game` 的強化學習對手就是走這條路(PyTorch →(ONNX)→ TensorFlow → TF.js)。訓練只是第一步,讓模型真正被人用到,才算完成一個專案。

> 👉 在 Colab 裡把模型匯出成 ONNX,再研究怎麼轉成 TF.js 放到網頁上跑。

走完這課,你已經完成從 tensor 到部署的完整旅程。下一個學習階段是 **大型語言模型(LLM)**——我們會從零打造一個迷你 GPT。
