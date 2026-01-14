"""
將 Keras 模型轉換為 TensorFlow.js 格式
生成符合 TensorFlow.js 預期的 Layers Model 格式
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
from tensorflow import keras
import json
import numpy as np

def convert_model():
    print("載入 Keras 模型...")
    model = keras.models.load_model('saved_model/mnist_model.keras')

    tfjs_dir = 'tfjs_model'
    os.makedirs(tfjs_dir, exist_ok=True)

    # 建立符合 TensorFlow.js 格式的 model.json
    # 參考: https://www.tensorflow.org/js/guide/save_load

    model_topology = {
        "class_name": "Sequential",
        "config": {
            "name": "sequential",
            "layers": []
        },
        "keras_version": "2.15.0",
        "backend": "tensorflow"
    }

    # 手動建立層配置（TensorFlow.js 格式）
    layers_config = [
        {
            "class_name": "Conv2D",
            "config": {
                "name": "conv2d",
                "trainable": True,
                "batch_input_shape": [None, 28, 28, 1],
                "dtype": "float32",
                "filters": 16,
                "kernel_size": [3, 3],
                "strides": [1, 1],
                "padding": "same",
                "data_format": "channels_last",
                "dilation_rate": [1, 1],
                "activation": "relu",
                "use_bias": True,
                "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                "bias_initializer": {"class_name": "Zeros", "config": {}}
            }
        },
        {
            "class_name": "MaxPooling2D",
            "config": {
                "name": "max_pooling2d",
                "trainable": True,
                "dtype": "float32",
                "pool_size": [2, 2],
                "padding": "valid",
                "strides": [2, 2],
                "data_format": "channels_last"
            }
        },
        {
            "class_name": "Conv2D",
            "config": {
                "name": "conv2d_1",
                "trainable": True,
                "dtype": "float32",
                "filters": 32,
                "kernel_size": [3, 3],
                "strides": [1, 1],
                "padding": "same",
                "data_format": "channels_last",
                "dilation_rate": [1, 1],
                "activation": "relu",
                "use_bias": True,
                "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                "bias_initializer": {"class_name": "Zeros", "config": {}}
            }
        },
        {
            "class_name": "MaxPooling2D",
            "config": {
                "name": "max_pooling2d_1",
                "trainable": True,
                "dtype": "float32",
                "pool_size": [2, 2],
                "padding": "valid",
                "strides": [2, 2],
                "data_format": "channels_last"
            }
        },
        {
            "class_name": "Flatten",
            "config": {
                "name": "flatten",
                "trainable": True,
                "dtype": "float32",
                "data_format": "channels_last"
            }
        },
        {
            "class_name": "Dropout",
            "config": {
                "name": "dropout",
                "trainable": True,
                "dtype": "float32",
                "rate": 0.3
            }
        },
        {
            "class_name": "Dense",
            "config": {
                "name": "dense",
                "trainable": True,
                "dtype": "float32",
                "units": 64,
                "activation": "relu",
                "use_bias": True,
                "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                "bias_initializer": {"class_name": "Zeros", "config": {}}
            }
        },
        {
            "class_name": "Dropout",
            "config": {
                "name": "dropout_1",
                "trainable": True,
                "dtype": "float32",
                "rate": 0.3
            }
        },
        {
            "class_name": "Dense",
            "config": {
                "name": "dense_1",
                "trainable": True,
                "dtype": "float32",
                "units": 10,
                "activation": "softmax",
                "use_bias": True,
                "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                "bias_initializer": {"class_name": "Zeros", "config": {}}
            }
        }
    ]

    model_topology["config"]["layers"] = layers_config

    # 權重清單
    weights_manifest = [{
        "paths": ["group1-shard1of1.bin"],
        "weights": [
            {"name": "conv2d/kernel", "shape": [3, 3, 1, 16], "dtype": "float32"},
            {"name": "conv2d/bias", "shape": [16], "dtype": "float32"},
            {"name": "conv2d_1/kernel", "shape": [3, 3, 16, 32], "dtype": "float32"},
            {"name": "conv2d_1/bias", "shape": [32], "dtype": "float32"},
            {"name": "dense/kernel", "shape": [1568, 64], "dtype": "float32"},
            {"name": "dense/bias", "shape": [64], "dtype": "float32"},
            {"name": "dense_1/kernel", "shape": [64, 10], "dtype": "float32"},
            {"name": "dense_1/bias", "shape": [10], "dtype": "float32"}
        ]
    }]

    # 完整的 model.json
    model_json = {
        "format": "layers-model",
        "generatedBy": "keras v2.15.0",
        "convertedBy": "TensorFlow.js Converter",
        "modelTopology": model_topology,
        "weightsManifest": weights_manifest
    }

    # 儲存 model.json
    print("生成 model.json...")
    with open(os.path.join(tfjs_dir, 'model.json'), 'w') as f:
        json.dump(model_json, f, indent=2)

    # 從模型提取權重並儲存為二進位
    print("提取並儲存權重...")
    weights_data = []

    # 按照 weightsManifest 的順序提取權重
    layer_names = ['conv2d', 'conv2d_1', 'dense', 'dense_1']
    for layer_name in layer_names:
        layer = model.get_layer(layer_name)
        kernel, bias = layer.get_weights()
        weights_data.append(kernel.astype(np.float32))
        weights_data.append(bias.astype(np.float32))

    # 合併所有權重為單一二進位檔
    all_weights = np.concatenate([w.flatten() for w in weights_data])
    all_weights.tofile(os.path.join(tfjs_dir, 'group1-shard1of1.bin'))

    # 計算並顯示檔案大小
    json_size = os.path.getsize(os.path.join(tfjs_dir, 'model.json'))
    bin_size = os.path.getsize(os.path.join(tfjs_dir, 'group1-shard1of1.bin'))
    total_size = json_size + bin_size

    print(f"\n轉換完成！")
    print(f"model.json: {json_size / 1024:.1f} KB")
    print(f"權重檔案: {bin_size / 1024:.1f} KB")
    print(f"總大小: {total_size / 1024:.1f} KB")
    print(f"\n輸出目錄: {tfjs_dir}/")

    # 驗證權重數量
    total_params = sum(w.size for w in weights_data)
    print(f"總參數量: {total_params:,}")

if __name__ == '__main__':
    convert_model()
