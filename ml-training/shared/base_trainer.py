"""
Base RL Trainer

統一的強化學習訓練框架，遵循 Template Method 模式
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Dict, Any
import gymnasium as gym
from stable_baselines3.common.vec_env import VecEnv
from stable_baselines3.common.callbacks import BaseCallback, CallbackList


class BaseRLTrainer(ABC):
    """
    RL 訓練基類

    子類需實作：
    - create_model(): 建立 RL 模型
    - export_tfjs(): 導出為 TF.js 格式
    """

    def __init__(
        self,
        env_id: str,
        output_dir: Path,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Args:
            env_id: Gymnasium 環境 ID
            output_dir: 輸出目錄
            config: 訓練配置
        """
        self.env_id = env_id
        self.output_dir = Path(output_dir)
        self.config = config or {}
        self.model = None

        # 建立輸出目錄
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir = self.output_dir / "logs"
        self.log_dir.mkdir(exist_ok=True)
        self.model_dir = self.output_dir / "models"
        self.model_dir.mkdir(exist_ok=True)

    @abstractmethod
    def create_model(self, env: VecEnv):
        """
        建立 RL 模型（PPO, DQN, etc.）

        Args:
            env: Vectorized environment

        Returns:
            Stable Baselines3 model instance
        """
        pass

    @abstractmethod
    def export_tfjs(self, model_path: Path, tfjs_path: Path):
        """
        導出模型為 TF.js 格式

        Args:
            model_path: 訓練好的模型路徑
            tfjs_path: TF.js 輸出路徑
        """
        pass

    def train(
        self,
        total_timesteps: int = 100_000,
        n_envs: int = 4,
        callbacks: Optional[list[BaseCallback]] = None,
        progress_bar: bool = True
    ):
        """
        統一訓練流程

        Args:
            total_timesteps: 訓練總步數
            n_envs: 並行環境數量
            callbacks: 訓練回調
            progress_bar: 是否顯示進度條
        """
        from stable_baselines3.common.env_util import make_vec_env

        print(f"=== Training {self.env_id} ===")
        print(f"Total timesteps: {total_timesteps:,}")
        print(f"Parallel envs: {n_envs}")
        print()

        # 建立向量化環境
        env = make_vec_env(self.env_id, n_envs=n_envs)

        # 建立模型
        if self.model is not None:
            print("Using existing model for training...")
            self.model.set_env(env)
        else:
            self.model = self.create_model(env)

        # 訓練
        self.model.learn(
            total_timesteps=total_timesteps,
            callback=callbacks,
            progress_bar=progress_bar
        )

        # 儲存模型
        model_path = self.model_dir / "final_model"
        self.model.save(str(model_path))
        print(f"\nModel saved to {model_path}.zip")

        env.close()
        return self.model

    def export(self, web_models_dir: Path):
        """
        導出模型為前端可用格式

        Args:
            web_models_dir: 網站 public/models/ 目錄
        """
        model_path = self.model_dir / "final_model.zip"
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        tfjs_path = web_models_dir / self.config.get('game_name', 'model')
        tfjs_path.mkdir(parents=True, exist_ok=True)

        print(f"\nExporting model to {tfjs_path}...")
        self.export_tfjs(model_path, tfjs_path)
        print(f"Export complete!")

    def evaluate(self, n_episodes: int = 10):
        """
        評估訓練好的模型

        Args:
            n_episodes: 評估回合數
        """
        if not self.model:
            model_path = self.model_dir / "final_model"
            if not model_path.with_suffix('.zip').exists():
                raise FileNotFoundError("No trained model found")

            # 重新載入模型
            from stable_baselines3 import PPO
            self.model = PPO.load(str(model_path))

        env = gym.make(self.env_id)

        scores = []
        for ep in range(n_episodes):
            obs, info = env.reset()
            total_reward = 0
            steps = 0

            while True:
                action, _ = self.model.predict(obs, deterministic=True)
                obs, reward, terminated, truncated, info = env.step(action)
                total_reward += reward
                steps += 1

                if terminated or truncated:
                    break

            score = info.get('score', 0)
            scores.append(score)
            print(f"Episode {ep+1}: score={score:3d}, steps={steps:4d}, reward={total_reward:.1f}")

        import numpy as np
        print(f"\nAverage score: {np.mean(scores):.1f} (±{np.std(scores):.1f})")
        env.close()
