#!/usr/bin/env python3
"""
導出 Stable Baselines3 PPO 模型到 TensorFlow SavedModel 格式
稍後可用 tensorflowjs_converter 轉換為 TF.js

使用方式:
1. python export_to_saved_model.py  # 導出 SavedModel
2. tensorflowjs_converter \
       --input_format=tf_saved_model \
       --output_format=tfjs_graph_model \
       output/saved_model \
       output/tfjs_model
"""

import sys
from pathlib import Path
import numpy as np

import tensorflow as tf
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


def main():
    # 設定路徑
    model_path = Path(__file__).parent / "output" / "models" / "final_model"
    saved_model_dir = Path(__file__).parent / "output" / "saved_model"

    print("=" * 60)
    print("Stable Baselines3 PPO → TensorFlow SavedModel")
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

    # 5. 保存為 SavedModel
    print(f"\n5. 保存 TensorFlow SavedModel: {saved_model_dir}")
    saved_model_dir.mkdir(parents=True, exist_ok=True)
    # 使用 export() 而不是 save()，因為我們要導出 SavedModel 格式
    tf_model.export(str(saved_model_dir))
    print(f"   ✓ 已保存到: {saved_model_dir}")

    print("\n" + "=" * 60)
    print("✓ SavedModel 導出完成！")
    print("=" * 60)
    print(f"\n下一步：轉換為 TF.js 格式")
    print(f"\n如果需要轉換為 TF.js，請執行:")
    print(f"  pip install tensorflowjs")
    print(f"  tensorflowjs_converter \\")
    print(f"      --input_format=tf_saved_model \\")
    print(f"      --output_format=tfjs_graph_model \\")
    print(f"      {saved_model_dir} \\")
    print(f"      {saved_model_dir.parent / 'tfjs_model'}\n")

    print(f"或者直接在瀏覽器中使用 SavedModel:")
    print(f"  // 載入模型")
    print(f"  const model = await tf.loadGraphModel('path/to/saved_model/model.json');")
    print(f"  // 預測")
    print(f"  const obs = tf.tensor2d([[...54 features...]], [1, 54]);")
    print(f"  const actionProbs = model.predict(obs);\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
