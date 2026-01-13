---
title: "在瀏覽器裡跑深度學習：手寫數字辨識實作筆記"
pubDate: 2026-01-13
description: "從零開始訓練 MNIST 模型，轉換為 TensorFlow.js 格式，並在瀏覽器中實現即時推理與 Saliency Map 可解釋性視覺化。完整記錄技術選型、踩坑經驗與效能優化。"
author: "wemee (with AI assistant)"
tags: ["machine-learning", "tensorflow", "browser", "mnist", "explainability"]
image: "/images/blog/mnist-browser-ml-cover.webp"
---

## 前言

最近想在網站上加一個「手寫數字辨識」的小工具。需求很簡單：使用者在畫布上寫數字，AI 即時辨識。但有幾個限制：

1. **純前端運作**：不想架後端 API，所有運算在瀏覽器完成
2. **手機也能用**：模型不能太大，載入要快
3. **可解釋性**：不只給答案，還要讓使用者知道「AI 看到了什麼」

這篇文章記錄整個開發過程，包括技術選型、踩過的坑、以及一些實作細節。

## 技術選型：TensorFlow.js vs ONNX Runtime Web

前端跑 ML 模型主要有兩個選擇：

| 框架 | 優點 | 缺點 |
|------|------|------|
| TensorFlow.js | 生態系成熟、文檔完整、社群大 | 套件較肥（~500KB） |
| ONNX Runtime Web | 推理速度快、runtime 輕量 | 文檔少、社群小 |

最後選擇 **TensorFlow.js**，主要原因是：
- Keras 模型可以直接轉換
- 遇到問題時 Stack Overflow 上找得到答案
- 對於 MNIST 這種小模型，效能差異可以忽略

## 模型設計：在精度與大小之間取捨

MNIST 是經典的入門資料集，用 CNN 隨便疊幾層就能達到 99%+ 準確度。但網頁端有大小限制，不能太奢侈。

### 最終架構

```
Input: 28×28×1
    ↓
Conv2D(16, 3×3, ReLU) → MaxPool(2×2)
    ↓
Conv2D(32, 3×3, ReLU) → MaxPool(2×2)
    ↓
Flatten → Dropout(0.3) → Dense(64, ReLU) → Dropout(0.3)
    ↓
Dense(10, Softmax)
```

### 設計考量

1. **Filter 數量精簡**：16 → 32，而非常見的 32 → 64 → 128
2. **只用一層全連接**：64 個神經元就夠了
3. **Dropout 防過擬合**：小模型容易 overfit，0.3 的比例剛好

### 訓練結果

| 指標 | 目標 | 實際 |
|------|------|------|
| 測試準確度 | ≥ 95% | **98.77%** |
| 模型大小 | < 500KB | **~420KB** |
| M1 Mac 訓練時間 | < 10 分鐘 | **1.2 分鐘** |

## 踩坑紀錄：Keras 3 與 TensorFlow.js 的相容性

這是花最多時間的地方。

### 問題

使用 `tensorflowjs_converter` CLI 工具時直接報錯：

```
AttributeError: module 'tensorflow.compat.v1' has no attribute 'estimator'
```

原因是 TensorFlow 2.20 搭配的 Keras 3 與舊版 tensorflowjs 套件不相容。

### 解決方案

自己寫 Python 腳本，手動生成 TensorFlow.js 需要的檔案格式：

1. **model.json**：模型結構，需要是 Keras 2 風格的 JSON
2. **group1-shard1of1.bin**：權重的二進位檔

關鍵是 `modelTopology` 的格式要對，TensorFlow.js 預期的結構比較扁平，不像 Keras 3 那麼巢狀。

## 前端實作重點

### 1. Canvas 手寫輸入

需要同時支援滑鼠和觸控：

```javascript
// 防止手機滑動干擾
canvas.style.touchAction = 'none';

// 觸控事件
canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
```

### 2. 圖片預處理

MNIST 的圖片有特定格式：28×28、黑底白字、數字置中。使用者的手寫筆跡需要做幾件事：

1. **找出邊界框**：偵測筆跡的最小包圍矩形
2. **置中縮放**：保持比例縮放到 20×20，周圍留 4px 邊距
3. **正規化**：像素值從 0-255 轉換到 0-1

這步驟做不好，辨識率會大幅下降。

### 3. Saliency Map 可解釋性

這是額外加的功能，讓使用者知道 AI 在「看哪裡」。

實作方式是 **Vanilla Gradient**：計算預測類別對輸入像素的梯度，絕對值越大表示該像素越重要。

```javascript
const gradientFunc = tf.grad(x => {
  const pred = model.predict(x);
  return pred.gather([predictedClass], 1).squeeze();
});
const gradients = gradientFunc(input);
```

效能影響很小（一次反向傳播），但視覺化效果很直觀。

## 實測心得

實際使用下來，有些數字比較難辨識：

- **4 容易被認成 9**：如果頂部封閉的話
- **7 容易被認成 1**：如果橫槓寫太短

這其實反映了 MNIST 資料集本身的特性——它是美國郵局收集的，書寫習慣跟中文圈不太一樣。

## 結語

整個專案從訓練到部署大概花了一個下午。最花時間的不是寫 code，而是搞定各種版本相容性問題。

如果你也想在網頁上跑 ML 模型，幾個建議：

1. **先確認轉換工具的版本相容性**
2. **模型不用太複雜**，小模型載入快、體驗好
3. **加上可解釋性功能**，使用者會覺得更有趣

完整的程式碼都在這個網站的 repo 裡，歡迎參考。

---

**工具連結**：[手寫數字辨識](/tools/digit-recognition/)
