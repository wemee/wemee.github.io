"""
Snake RL Training Script

Uses Compact11Wrapper (11-dimensional feature vector) with DQN.
Early stops when average score reaches 30 (3 apples).
"""

import sys
sys.path.insert(0, '..')

import os
import json
import numpy as np
from stable_baselines3 import DQN
from stable_baselines3.common.callbacks import BaseCallback, EvalCallback
from stable_baselines3.common.monitor import Monitor

from environments import SnakeEnv, Compact11Wrapper


class EarlyStopOnScore(BaseCallback):
    """Stop training when average eval score reaches target."""

    def __init__(self, target_score: float, eval_env, n_eval_episodes: int = 10, 
                 eval_freq: int = 2000, verbose: int = 1):
        super().__init__(verbose)
        self.target_score = target_score
        self.eval_env = eval_env
        self.n_eval_episodes = n_eval_episodes
        self.eval_freq = eval_freq
        self.best_mean_score = -np.inf

    def _on_step(self) -> bool:
        if self.n_calls % self.eval_freq != 0:
            return True

        # Evaluate
        scores = []
        for _ in range(self.n_eval_episodes):
            obs, _ = self.eval_env.reset()
            episode_score = 0
            done = False
            while not done:
                action, _ = self.model.predict(obs, deterministic=True)
                obs, reward, terminated, truncated, info = self.eval_env.step(int(action))
                episode_score = info.get("score", 0)
                done = terminated or truncated
            scores.append(episode_score)

        mean_score = np.mean(scores)
        if mean_score > self.best_mean_score:
            self.best_mean_score = mean_score

        if self.verbose:
            print(f"\n[Eval @ {self.n_calls}] Mean Score: {mean_score:.1f} (Best: {self.best_mean_score:.1f})")

        if mean_score >= self.target_score:
            print(f"\n🎯 Target score {self.target_score} reached! Stopping training.")
            return False

        return True


def make_env(seed: int = 0):
    """Create wrapped environment."""
    env = SnakeEnv(grid_width=10, grid_height=10)
    env = Compact11Wrapper(env)
    env = Monitor(env)
    env.reset(seed=seed)
    return env


def train():
    """Train DQN agent on Snake."""
    print("=" * 50)
    print("Snake RL Training (DQN + Compact11 Features)")
    print("Target: Average 30 points (3 apples)")
    print("=" * 50)

    # Create environments
    train_env = make_env(seed=42)
    eval_env = make_env(seed=123)

    # Create DQN agent
    model = DQN(
        "MlpPolicy",
        train_env,
        learning_rate=1e-3,
        buffer_size=50000,
        learning_starts=500,
        batch_size=64,
        tau=0.1,
        gamma=0.99,
        train_freq=4,
        gradient_steps=1,
        target_update_interval=500,
        exploration_fraction=0.3,
        exploration_initial_eps=1.0,
        exploration_final_eps=0.05,
        verbose=1,
    )

    # Early stop callback
    early_stop = EarlyStopOnScore(
        target_score=30,  # 3 apples * 10 points
        eval_env=eval_env,
        n_eval_episodes=10,
        eval_freq=2000,
        verbose=1,
    )

    # Train
    print("\nStarting training...")
    print("Grid: 10x10, Features: 11-dim, Algorithm: DQN")
    print("-" * 50)

    model.learn(
        total_timesteps=500_000,  # Max, will stop early
        callback=early_stop,
        progress_bar=True,
    )

    # Save model
    os.makedirs("./output", exist_ok=True)
    model.save("./output/snake_dqn")
    print(f"\n✅ Model saved to: ./output/snake_dqn.zip")

    # Export weights for TensorFlow.js
    export_weights(model)

    return model


def export_weights(model):
    """Export DQN weights to JSON for TensorFlow.js."""
    print("\n--- Exporting weights for TF.js ---")

    # Get Q-network parameters
    params = model.q_net.state_dict()

    weights = {}
    for name, tensor in params.items():
        weights[name] = tensor.cpu().numpy().tolist()

    os.makedirs("./output", exist_ok=True)
    with open("./output/snake_weights.json", "w") as f:
        json.dump(weights, f)

    print(f"✅ Weights exported to: ./output/snake_weights.json")
    print(f"   Layers: {list(weights.keys())}")


if __name__ == "__main__":
    train()

