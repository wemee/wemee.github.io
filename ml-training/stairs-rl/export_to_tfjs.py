#!/usr/bin/env python3
"""
導出 Stable Baselines3 PPO 模型到 TensorFlow.js 格式

只導出 policy network (不含 value network)
"""

import sys
import json
from pathlib import Path
import numpy as np

# 檢查 TensorFlow 是否安裝
try:
    import tensorflow as tf
    print(f"✓ TensorFlow version: {tf.__version__}")
except ImportError:
    print("❌ TensorFlow not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "tensorflow>=2.13.0"])
    import tensorflow as tf

# 檢查 tensorflowjs 是否安裝
try:
    import tensorflowjs as tfjs
    print(f"✓ TensorFlow.js converter version: {tfjs.__version__}")
except ImportError:
    print("❌ tensorflowjs not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "tensorflowjs>=4.10.0"])
    import tensorflowjs as tfjs

from stable_baselines3 import PPO
import torch


def extract_policy_weights(model):
    """從 SB3 PPO 模型提取 policy network 權重"""
    weights = {}

    # 提取 policy_net 的權重 (2層 MLP)
    policy_net = model.policy.mlp_extractor.policy_net

    # Layer 1: Linear(54 → 64) + Tanh
    weights['layer1_kernel'] = policy_net[0].weight.data.cpu().numpy().T  # PyTorch 是 (out, in)，TF 是 (in, out)
    weights['layer1_bias'] = policy_net[0].bias.data.cpu().numpy()

    # Layer 2: Linear(64 → 64) + Tanh
    weights['layer2_kernel'] = policy_net[2].weight.data.cpu().numpy().T
    weights['layer2_bias'] = policy_net[2].bias.data.cpu().numpy()

    # Action layer: Linear(64 → 3)
    weights['action_kernel'] = model.policy.action_net.weight.data.cpu().numpy().T
    weights['action_bias'] = model.policy.action_net.bias.data.cpu().numpy()

    return weights


def create_tf_model(weights):
    """使用提取的權重建立 TensorFlow 模型"""
    # 定義模型結構 (與 PyTorch 模型一致)
    inputs = tf.keras.Input(shape=(54,), name='observation')

    # Layer 1: Dense(54 → 64) + Tanh
    x = tf.keras.layers.Dense(
        64,
        activation='tanh',
        kernel_initializer=tf.constant_initializer(weights['layer1_kernel']),
        bias_initializer=tf.constant_initializer(weights['layer1_bias']),
        name='policy_layer1'
    )(inputs)

    # Layer 2: Dense(64 → 64) + Tanh
    x = tf.keras.layers.Dense(
        64,
        activation='tanh',
        kernel_initializer=tf.constant_initializer(weights['layer2_kernel']),
        bias_initializer=tf.constant_initializer(weights['layer2_bias']),
        name='policy_layer2'
    )(x)

    # Action layer: Dense(64 → 3) + Softmax
    action_logits = tf.keras.layers.Dense(
        3,
        kernel_initializer=tf.constant_initializer(weights['action_kernel']),
        bias_initializer=tf.constant_initializer(weights['action_bias']),
        name='action_logits'
    )(x)

    action_probs = tf.keras.layers.Softmax(name='action_probs')(action_logits)

    # 建立模型
    model = tf.keras.Model(inputs=inputs, outputs=action_probs, name='stairs_policy')

    return model


def verify_model_consistency(sb3_model, tf_model, n_tests=10):
    """驗證 PyTorch 和 TensorFlow 模型輸出一致性"""
    print("\n驗證模型一致性...")

    max_diff = 0.0
    for i in range(n_tests):
        # 生成隨機觀察
        obs = np.random.randn(1, 54).astype(np.float32)

        # PyTorch 預測
        with torch.no_grad():
            obs_tensor = torch.FloatTensor(obs)
            features = sb3_model.policy.extract_features(obs_tensor)
            latent_pi, _ = sb3_model.policy.mlp_extractor(features)
            action_logits = sb3_model.policy.action_net(latent_pi)
            pytorch_probs = torch.softmax(action_logits, dim=-1).numpy()

        # TensorFlow 預測
        tf_probs = tf_model.predict(obs, verbose=0)

        # 比較差異
        diff = np.abs(pytorch_probs - tf_probs).max()
        max_diff = max(max_diff, diff)

        if i == 0:
            print(f"  測試 {i+1}:")
            print(f"    PyTorch:    {pytorch_probs[0]}")
            print(f"    TensorFlow: {tf_probs[0]}")
            print(f"    最大差異:    {diff:.2e}")

    print(f"\n  {n_tests} 次測試的最大差異: {max_diff:.2e}")

    if max_diff < 1e-6:
        print("  ✓ 模型一致性驗證通過！")
        return True
    elif max_diff < 1e-4:
        print("  ⚠️  模型差異在可接受範圍內")
        return True
    else:
        print("  ❌ 模型差異過大，請檢查權重轉換")
        return False


def export_to_tfjs(tf_model, output_dir):
    """導出 TensorFlow 模型到 TF.js 格式"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\n導出到 TF.js 格式: {output_path}")

    # 使用 tensorflowjs converter
    tfjs.converters.save_keras_model(tf_model, str(output_path))

    print(f"✓ 模型已導出到: {output_path}")
    print(f"  - model.json: 模型結構")
    print(f"  - group*.bin: 權重檔案")

    # 建立元資料
    metadata = {
        "format": "tfjs-layers",
        "modelTopology": "model.json",
        "inputShape": [54],
        "outputShape": [3],
        "actions": ["left", "right", "none"],
        "description": "Stairs Game PPO Policy Network",
        "framework": "Stable Baselines3 → TensorFlow.js"
    }

    with open(output_path / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"✓ 元資料已保存到: {output_path / 'metadata.json'}")


def main():
    # 設定路徑
    model_path = Path(__file__).parent / "output" / "models" / "final_model"
    tfjs_output_dir = Path(__file__).parent / "output" / "tfjs_model"

    print("=" * 60)
    print("Stable Baselines3 PPO → TensorFlow.js 轉換")
    print("=" * 60)

    # 1. 載入 SB3 模型
    print(f"\n1. 載入 PPO 模型: {model_path}")
    sb3_model = PPO.load(str(model_path))
    print("   ✓ 模型已載入")

    # 2. 提取權重
    print("\n2. 提取 policy network 權重...")
    weights = extract_policy_weights(sb3_model)
    print(f"   ✓ 已提取 {len(weights)} 組權重:")
    for name, weight in weights.items():
        print(f"     - {name}: {weight.shape}")

    # 3. 建立 TensorFlow 模型
    print("\n3. 建立 TensorFlow 模型...")
    tf_model = create_tf_model(weights)
    print("   ✓ 模型已建立")
    print("\n   模型摘要:")
    tf_model.summary()

    # 4. 驗證一致性
    is_consistent = verify_model_consistency(sb3_model, tf_model, n_tests=10)

    if not is_consistent:
        print("\n❌ 模型驗證失敗，停止導出")
        return 1

    # 5. 導出到 TF.js
    export_to_tfjs(tf_model, tfjs_output_dir)

    print("\n" + "=" * 60)
    print("✓ 轉換完成！")
    print("=" * 60)
    print(f"\n使用方式:")
    print(f"1. 在瀏覽器中載入模型:")
    print(f"   const model = await tf.loadLayersModel('/path/to/tfjs_model/model.json');")
    print(f"2. 進行預測:")
    print(f"   const observation = tf.tensor2d([[...54 features...]], [1, 54]);")
    print(f"   const actionProbs = model.predict(observation);")
    print(f"3. 選擇動作:")
    print(f"   const action = actionProbs.argMax(-1).dataSync()[0];")
    print(f"   // 0=left, 1=right, 2=none\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
