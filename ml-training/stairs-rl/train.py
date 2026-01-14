"""
Stairs Game RL Training

使用統一訓練框架訓練 PPO agent
"""

import sys
from pathlib import Path

# 加入 shared 到路徑
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))

from base_trainer import BaseRLTrainer
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
import gymnasium as gym

# Import environment (registers Stairs-v0)
import stairs_env


class StairsRLTrainer(BaseRLTrainer):
    """Stairs Game RL Trainer"""

    def create_model(self, env):
        """建立 PPO 模型"""
        return PPO(
            "MlpPolicy",
            env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.01,
            verbose=1,
            tensorboard_log=str(self.log_dir),
        )

    def export_tfjs(self, model_path, tfjs_path):
        """導出為 TF.js 格式"""
        print("\n⚠️  TF.js export not yet implemented.")
        print("Current model saved as PyTorch (.zip)")
        print("\nTo use in browser:")
        print("1. Manual conversion: PyTorch → ONNX → TensorFlow → TF.js")
        print("2. Or use ONNX Runtime Web directly")
        print("3. Or train with TensorFlow from scratch")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Train Stairs RL Agent')
    parser.add_argument('--timesteps', type=int, default=500_000,
                        help='Total training timesteps (default: 500,000)')
    parser.add_argument('--n-envs', type=int, default=4,
                        help='Number of parallel environments (default: 4)')
    parser.add_argument('--eval', action='store_true',
                        help='Evaluate existing model instead of training')
    args = parser.parse_args()

    # 建立訓練器
    output_dir = Path(__file__).parent / "output"
    trainer = StairsRLTrainer(
        env_id='Stairs-v0',
        output_dir=output_dir,
        config={'game_name': 'stairs'}
    )

    if args.eval:
        # 評估模式
        print("=== Evaluating Model ===\n")
        trainer.evaluate(n_episodes=20)
    else:
        # 訓練模式
        # 設定回調
        eval_env = gym.make('Stairs-v0')
        callbacks = [
            EvalCallback(
                eval_env,
                best_model_save_path=str(trainer.model_dir),
                log_path=str(trainer.log_dir),
                eval_freq=10000,
                deterministic=True,
                render=False,
            ),
            CheckpointCallback(
                save_freq=50000,
                save_path=str(trainer.model_dir),
                name_prefix="stairs_ppo",
            )
        ]

        print(f"Monitor training with: tensorboard --logdir {trainer.log_dir}\n")

        # 訓練
        trainer.train(
            total_timesteps=args.timesteps,
            n_envs=args.n_envs,
            callbacks=callbacks,
            progress_bar=True
        )

        eval_env.close()

        # 評估最終模型
        print("\n=== Final Evaluation ===\n")
        trainer.evaluate(n_episodes=10)


if __name__ == "__main__":
    main()
