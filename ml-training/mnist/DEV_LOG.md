# MNIST 手寫數字辨識模型開發日誌

## 專案目標

建立一個可在網頁端運行的手寫數字辨識系統，具備以下特點：
- 準確度 ≥ 95%
- 模型大小 < 500KB（適合網頁載入）
- 支援手機瀏覽器
- 可解釋性（預測機率視覺化）

## 技術選型

### 訓練框架：TensorFlow / Keras
選擇原因：
- 可直接匯出為 TensorFlow.js 格式
- 生態系成熟，文檔完整

### 前端推理：TensorFlow.js
選擇原因：
- 社群最大，約 70-80% 的網頁端 ML 專案使用
- 相較 ONNX Runtime Web，入門門檻較低
- 遇到問題時較容易找到解決方案

## 模型架構

採用輕量級 CNN 設計：

```
Input: 28x28x1 (灰階圖片)
    ↓
Conv2D(16, 3x3, ReLU, same) → 28x28x16
    ↓
MaxPooling2D(2x2) → 14x14x16
    ↓
Conv2D(32, 3x3, ReLU, same) → 14x14x32
    ↓
MaxPooling2D(2x2) → 7x7x32
    ↓
Flatten → 1568
    ↓
Dropout(0.3)
    ↓
Dense(64, ReLU)
    ↓
Dropout(0.3)
    ↓
Dense(10, Softmax)
    ↓
Output: 10 類別機率
```

### 設計考量

1. **Filter 數量精簡**：16 → 32，而非傳統的 32 → 64，大幅減少參數量
2. **單一全連接層**：只用 64 個神經元，夠用即可
3. **Dropout 防止過擬合**：0.3 的 dropout rate 在小模型上效果不錯

## 訓練結果

- **測試集準確度**：98.77%（超過 95% 目標）
- **模型參數量**：105,866
- **權重檔案大小**：413.5 KB（符合 < 500KB 目標）
- **訓練時間**：1.2 分鐘（M1 Mac，遠低於 10 分鐘限制）

## 遇到的問題與解決方案

### 問題 1：TensorFlowJS Converter 版本不相容

**現象**：使用 `tensorflowjs_converter` CLI 工具時出現錯誤：
```
AttributeError: module 'tensorflow.compat.v1' has no attribute 'estimator'
```

**原因**：TensorFlow 2.20 與 tensorflowjs 3.18 之間的 API 相容性問題

**解決方案**：自行撰寫 Python 轉換腳本，手動生成符合 TensorFlow.js 格式的 `model.json` 和權重二進位檔

### 問題 2：Keras 3 vs Keras 2 格式差異

**現象**：Keras 3 的 `model.to_json()` 輸出格式與 TensorFlow.js 預期的 Keras 2 格式不同

**解決方案**：在轉換腳本中手動建構 TensorFlow.js 預期的 model topology 結構

## 輸出檔案

```
public/models/mnist/
├── model.json          # 模型結構 (5.9 KB)
└── group1-shard1of1.bin  # 權重檔案 (413.5 KB)
```

## 下一步：前端整合

待實作項目：
1. Canvas 繪圖介面
2. 圖片預處理（置中、縮放、正規化）
3. TensorFlow.js 模型載入與推理
4. 預測結果視覺化（Top-3 機率長條圖）
5. Grad-CAM 熱點圖（可選）

## 參考資源

- [TensorFlow.js 官方文檔](https://www.tensorflow.org/js)
- [Keras MNIST CNN 範例](https://keras.io/examples/vision/mnist_convnet/)
- [TensorFlow.js Model 格式說明](https://www.tensorflow.org/js/guide/save_load)
