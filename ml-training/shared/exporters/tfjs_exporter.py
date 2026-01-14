"""
TensorFlow.js Model Exporter

從 PyTorch (Stable Baselines3) 導出模型為 TF.js 格式

方法 1: PyTorch -> ONNX -> TensorFlow -> TF.js (推薦)
方法 2: 手動重建 TensorFlow 模型並複製權重
"""

import torch
import torch.nn as nn
import numpy as np
from pathlib import Path
from typing import Tuple
import subprocess
import tempfile


class TFJSExporter:
    """
    將 Stable Baselines3 的 PyTorch 模型導出為 TF.js
    """

    @staticmethod
    def export_sb3_policy(
        model_path: Path,
        output_path: Path,
        input_shape: Tuple[int, ...] = (54,),
        output_shape: Tuple[int, ...] = (3,)
    ):
        """
        導出 SB3 策略網路為 TF.js

        Args:
            model_path: .zip 模型路徑
            output_path: TF.js 輸出目錄
            input_shape: 輸入形狀
            output_shape: 輸出形狀（動作數量）
        """
        from stable_baselines3 import PPO
        import tensorflow as tf

        print(f"Loading model from {model_path}...")
        model = PPO.load(str(model_path))

        # 取得策略網路
        policy = model.policy

        print("Extracting PyTorch weights...")

        # 取得 MLP 層的權重
        state_dict = policy.mlp_extractor.state_dict()
        pi_features = policy.mlp_extractor.latent_dim_pi

        # 建立 TensorFlow 模型
        print("Building TensorFlow model...")
        tf_model = TFJSExporter._build_tf_model(
            input_shape[0],
            pi_features,
            output_shape[0]
        )

        # 複製權重
        print("Transferring weights...")
        TFJSExporter._transfer_weights(policy, tf_model)

        # 儲存為 TF.js
        output_path = Path(output_path)
        output_path.mkdir(parents=True, exist_ok=True)

        print(f"Converting to TF.js format...")
        tf_model.save(str(output_path / "tf_model"), save_format='tf')

        # 使用 tfjs-converter
        try:
            subprocess.run([
                "tensorflowjs_converter",
                "--input_format=tf_saved_model",
                str(output_path / "tf_model"),
                str(output_path)
            ], check=True)

            # 清理臨時 TF 模型
            import shutil
            shutil.rmtree(output_path / "tf_model")

            print(f"Model exported successfully to {output_path}")
        except subprocess.CalledProcessError:
            print("ERROR: tensorflowjs_converter not found.")
            print("Install it with: pip install tensorflowjs")
            raise

    @staticmethod
    def _build_tf_model(input_dim: int, hidden_dim: int, output_dim: int):
        """
        建立 TensorFlow 模型（對應 SB3 的 MLP 策略）
        """
        import tensorflow as tf

        model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(hidden_dim, activation='relu'),
            tf.keras.layers.Dense(hidden_dim, activation='relu'),
            tf.keras.layers.Dense(output_dim, activation='softmax')
        ])

        return model

    @staticmethod
    def _transfer_weights(pytorch_policy, tf_model):
        """
        從 PyTorch 策略複製權重到 TensorFlow 模型
        """
        import tensorflow as tf

        # 這是簡化版本，實際需要根據具體的策略架構調整
        # SB3 的 MLP 策略有複雜的結構，這裡只示範基本思路

        print("WARNING: Weight transfer is simplified.")
        print("For production use, consider training directly with TensorFlow.")

        # 取得 PyTorch 參數
        with torch.no_grad():
            # 特徵提取器
            policy_net = pytorch_policy.mlp_extractor.policy_net

            # 假設是 2 層 MLP
            if len(list(policy_net.parameters())) >= 2:
                # Layer 1
                w1 = list(policy_net.parameters())[0].cpu().numpy().T
                b1 = list(policy_net.parameters())[1].cpu().numpy()

                # Layer 2 (如果存在)
                if len(list(policy_net.parameters())) >= 4:
                    w2 = list(policy_net.parameters())[2].cpu().numpy().T
                    b2 = list(policy_net.parameters())[3].cpu().numpy()

                    # 動作頭
                    action_net = pytorch_policy.action_net
                    w3 = list(action_net.parameters())[0].cpu().numpy().T
                    b3 = list(action_net.parameters())[1].cpu().numpy()

                    # 設定 TF 權重
                    tf_model.layers[0].set_weights([w1, b1])
                    tf_model.layers[1].set_weights([w2, b2])
                    tf_model.layers[2].set_weights([w3, b3])

                    print("Weights transferred successfully")


# 簡化的導出函數
def export_for_tfjs(model_path: str, output_dir: str):
    """
    便利函數：導出 SB3 模型為 TF.js

    Usage:
        export_for_tfjs('models/stairs_ppo.zip', 'public/models/stairs/')
    """
    TFJSExporter.export_sb3_policy(
        Path(model_path),
        Path(output_dir),
        input_shape=(54,),  # Stairs 觀察空間
        output_shape=(3,)    # 3 個動作
    )
