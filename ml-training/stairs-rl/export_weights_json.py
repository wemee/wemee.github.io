#!/usr/bin/env python3
"""
導出模型權重為 JSON 格式，供瀏覽器端使用

這種方法不需要 tensorflowjs 依賴，直接導出權重數據。
在瀏覽器中，我們會用 TF.js 手動構建相同的模型結構並載入這些權重。
"""

import sys
import json
from pathlib import Path
import numpy as np
from stable_baselines3 import PPO


def numpy_to_list(arr):
    """將 numpy 陣列轉換為 Python list (用於 JSON 序列化)"""
    return arr.tolist()


def extract_weights_as_json(model):
    """從 SB3 PPO 模型提取 policy network 權重並轉換為 JSON 格式"""
    policy_net = model.policy.mlp_extractor.policy_net

    # 提取所有層的權重
    weights = {
        "model_info": {
            "architecture": "PPO Policy Network",
            "input_dim": 54,
            "hidden_dim": 64,
            "output_dim": 3,
            "activation": "tanh",
            "framework": "Stable Baselines3 → TF.js"
        },
        "weights": {
            # Layer 1: Dense(54 → 64)
            "policy_layer1": {
                "kernel": numpy_to_list(policy_net[0].weight.data.cpu().numpy().T),  # (54, 64)
                "bias": numpy_to_list(policy_net[0].bias.data.cpu().numpy())  # (64,)
            },
            # Layer 2: Dense(64 → 64)
            "policy_layer2": {
                "kernel": numpy_to_list(policy_net[2].weight.data.cpu().numpy().T),  # (64, 64)
                "bias": numpy_to_list(policy_net[2].bias.data.cpu().numpy())  # (64,)
            },
            # Action layer: Dense(64 → 3)
            "action_logits": {
                "kernel": numpy_to_list(model.policy.action_net.weight.data.cpu().numpy().T),  # (64, 3)
                "bias": numpy_to_list(model.policy.action_net.bias.data.cpu().numpy())  # (3,)
            }
        }
    }

    return weights


def main():
    # 設定路徑
    model_path = Path(__file__).parent / "output" / "models" / "final_model"
    json_output_path = Path(__file__).parent / "output" / "model_weights.json"

    print("=" * 60)
    print("導出 PPO Policy 權重為 JSON")
    print("=" * 60)

    # 1. 載入模型
    print(f"\n1. 載入 PPO 模型: {model_path}")
    model = PPO.load(str(model_path))
    print("   ✓ 模型已載入")

    # 2. 提取權重
    print("\n2. 提取 policy network 權重...")
    weights_json = extract_weights_as_json(model)
    print("   ✓ 權重已提取")
    print(f"   - Input dim:  {weights_json['model_info']['input_dim']}")
    print(f"   - Hidden dim: {weights_json['model_info']['hidden_dim']}")
    print(f"   - Output dim: {weights_json['model_info']['output_dim']}")
    print(f"   - Activation: {weights_json['model_info']['activation']}")

    # 3. 保存為 JSON
    print(f"\n3. 保存權重到: {json_output_path}")
    json_output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(json_output_path, 'w') as f:
        json.dump(weights_json, f, indent=2)

    # 計算檔案大小
    file_size = json_output_path.stat().st_size
    print(f"   ✓ 已保存 ({file_size:,} bytes = {file_size/1024:.1f} KB)")

    print("\n" + "=" * 60)
    print("✓ 導出完成！")
    print("=" * 60)
    print(f"\n使用方式 (在瀏覽器 JS 中):")
    print(f"""
// 1. 載入權重
const response = await fetch('/path/to/model_weights.json');
const data = await response.json();

// 2. 構建模型結構 (與 Python 模型一致)
const model = tf.sequential({{
  layers: [
    tf.layers.dense({{units: 64, activation: 'tanh', inputShape: [54]}}),
    tf.layers.dense({{units: 64, activation: 'tanh'}}),
    tf.layers.dense({{units: 3, activation: 'softmax'}})
  ]
}});

// 3. 載入權重
model.layers[0].setWeights([
  tf.tensor2d(data.weights.policy_layer1.kernel),
  tf.tensor1d(data.weights.policy_layer1.bias)
]);
model.layers[1].setWeights([
  tf.tensor2d(data.weights.policy_layer2.kernel),
  tf.tensor1d(data.weights.policy_layer2.bias)
]);
model.layers[2].setWeights([
  tf.tensor2d(data.weights.action_logits.kernel),
  tf.tensor1d(data.weights.action_logits.bias)
]);

// 4. 進行預測
const observation = tf.tensor2d([[...54 features...]], [1, 54]);
const actionProbs = model.predict(observation);
const action = actionProbs.argMax(-1).dataSync()[0];  // 0=left, 1=right, 2=none
""")

    return 0


if __name__ == "__main__":
    sys.exit(main())
