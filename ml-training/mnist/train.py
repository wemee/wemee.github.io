"""
MNIST 手寫數字辨識模型訓練腳本
目標：95%+ 準確度，權重 < 500KB，M1 Mac 10 分鐘內完成
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # 減少 TensorFlow 輸出

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
import time

def create_lightweight_cnn():
    """
    建立輕量級 CNN 模型
    結構設計考量：
    - 使用較少的 filter 數量以減少模型大小
    - 2 個卷積層足以捕捉 MNIST 的特徵
    - Dropout 防止過擬合
    """
    model = keras.Sequential([
        # 輸入層：28x28x1 灰階圖片
        layers.Input(shape=(28, 28, 1)),

        # 第一個卷積區塊
        layers.Conv2D(16, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),

        # 第二個卷積區塊
        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),

        # 展平並全連接
        layers.Flatten(),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(10, activation='softmax')
    ])

    return model

def load_and_preprocess_data():
    """載入並預處理 MNIST 資料集"""
    (x_train, y_train), (x_test, y_test) = keras.datasets.mnist.load_data()

    # 正規化到 0-1 範圍
    x_train = x_train.astype('float32') / 255.0
    x_test = x_test.astype('float32') / 255.0

    # 增加 channel 維度 (28, 28) -> (28, 28, 1)
    x_train = np.expand_dims(x_train, -1)
    x_test = np.expand_dims(x_test, -1)

    print(f"訓練資料: {x_train.shape}, 測試資料: {x_test.shape}")

    return (x_train, y_train), (x_test, y_test)

def train_model():
    """訓練模型主函數"""
    print("=" * 50)
    print("MNIST 手寫數字辨識模型訓練")
    print("=" * 50)

    # 載入資料
    print("\n[1/4] 載入 MNIST 資料集...")
    (x_train, y_train), (x_test, y_test) = load_and_preprocess_data()

    # 建立模型
    print("\n[2/4] 建立輕量級 CNN 模型...")
    model = create_lightweight_cnn()

    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )

    model.summary()

    # 計算模型參數量
    total_params = model.count_params()
    estimated_size_kb = total_params * 4 / 1024  # float32 = 4 bytes
    print(f"\n模型參數量: {total_params:,}")
    print(f"預估權重大小: {estimated_size_kb:.1f} KB")

    # 訓練模型
    print("\n[3/4] 開始訓練...")
    start_time = time.time()

    # 使用 Early Stopping 避免過擬合
    early_stopping = keras.callbacks.EarlyStopping(
        monitor='val_accuracy',
        patience=3,
        restore_best_weights=True
    )

    history = model.fit(
        x_train, y_train,
        epochs=15,
        batch_size=128,
        validation_split=0.1,
        callbacks=[early_stopping],
        verbose=1
    )

    training_time = time.time() - start_time
    print(f"\n訓練耗時: {training_time:.1f} 秒 ({training_time/60:.1f} 分鐘)")

    # 評估模型
    print("\n[4/4] 評估模型...")
    test_loss, test_accuracy = model.evaluate(x_test, y_test, verbose=0)
    print(f"測試集準確度: {test_accuracy * 100:.2f}%")

    # 檢查是否達標
    if test_accuracy >= 0.95:
        print("✓ 達到 95% 準確度目標！")
    else:
        print("✗ 未達到 95% 準確度目標")

    if estimated_size_kb < 500:
        print("✓ 模型大小在 500KB 以內！")
    else:
        print("✗ 模型大小超過 500KB")

    # 儲存模型
    print("\n儲存模型...")
    os.makedirs('saved_model', exist_ok=True)
    model.save('saved_model/mnist_model.keras')
    print("模型已儲存至 saved_model/mnist_model.keras")

    return model, history

if __name__ == '__main__':
    model, history = train_model()
