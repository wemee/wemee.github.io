"""
Snake RL Training Script - Advanced LIDAR Vision

Trains a DQN agent using the LidarHungerWrapper with:
- 8-directional ray casting (LIDAR) for obstacle detection
- Hunger penalty to prevent looping behavior
- Food approach reward for guided exploration

Usage:
    python train_lidar.py                     # Default: 1M steps
    python train_lidar.py --timesteps 500000  # Train for 500K steps
    python train_lidar.py --deploy            # Auto-deploy after training
"""

import sys
import os
import json
import argparse
from pathlib import Path

import numpy as np
from stable_baselines3 import DQN
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.monitor import Monitor

# Ensure environments package is importable
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))

from environments import SnakeEnv, LidarHungerWrapper

# Output directory (relative to this script)
OUTPUT_DIR = SCRIPT_DIR / "output"


class MultiSeedEvalCallback(BaseCallback):
    """
    Evaluate using multiple random seeds for accurate performance measurement.
    Logs detailed statistics and saves best model.
    """

    def __init__(
        self,
        eval_env,
        target_score: float = 300.0,
        n_eval_episodes: int = 20,
        eval_freq: int = 10000,
        save_path: Path = None,
        verbose: int = 1,
    ):
        super().__init__(verbose)
        self.eval_env = eval_env
        self.target_score = target_score
        self.n_eval_episodes = n_eval_episodes
        self.eval_freq = eval_freq
        self.save_path = save_path
        self.best_mean_score = -np.inf

    def _on_step(self) -> bool:
        if self.n_calls % self.eval_freq != 0:
            return True

        # Evaluate with different seeds for each episode
        scores = []
        lengths = []
        for episode in range(self.n_eval_episodes):
            seed = episode * 137 + 42  # Different seed per episode
            obs, _ = self.eval_env.reset(seed=seed)
            done = False
            while not done:
                action, _ = self.model.predict(obs, deterministic=True)
                obs, _, terminated, truncated, info = self.eval_env.step(int(action))
                done = terminated or truncated
            scores.append(info.get("score", 0))
            lengths.append(info.get("snake_length", 3))

        mean_score = np.mean(scores)
        std_score = np.std(scores)
        mean_length = np.mean(lengths)
        min_score = min(scores)
        max_score = max(scores)

        # Save best model
        if mean_score > self.best_mean_score:
            self.best_mean_score = mean_score
            if self.save_path:
                self.model.save(str(self.save_path / "snake_lidar_best.zip"))

        if self.verbose:
            print(f"\n[Eval @ {self.n_calls:,}] "
                  f"Score: {mean_score:.1f} ± {std_score:.1f} | "
                  f"Length: {mean_length:.1f} | "
                  f"Min: {min_score} | Max: {max_score} | "
                  f"Best: {self.best_mean_score:.1f}")

        if mean_score >= self.target_score:
            print(f"\n🎯 Target score {self.target_score} reached!")
            return False

        return True


def make_env(seed: int = 0, grid_size: int = 10) -> LidarHungerWrapper:
    """Create Snake environment with LidarHunger wrapper."""
    env = SnakeEnv(grid_width=grid_size, grid_height=grid_size, max_steps=500)
    env = LidarHungerWrapper(
        env,
        base_hunger_penalty=-0.01,
        hunger_increment=-0.01,
        max_hunger_penalty=-0.5,
    )
    env = Monitor(env)
    env.reset(seed=seed)
    return env


def export_weights(model: DQN, output_path: Path) -> None:
    """Export Q-network weights to JSON for browser inference."""
    params = model.q_net.state_dict()
    weights = {name: tensor.cpu().numpy().tolist() for name, tensor in params.items()}
    
    with open(output_path, "w") as f:
        json.dump(weights, f)
    
    print(f"✅ Weights exported: {output_path}")


def train(args: argparse.Namespace) -> DQN:
    """Train DQN agent on Snake with LIDAR vision."""
    print("=" * 60)
    print("Snake RL Training - LIDAR Vision")
    print(f"  Target Score: {args.target_score}")
    print(f"  Max Timesteps: {args.timesteps:,}")
    print(f"  Grid Size: {args.grid_size}x{args.grid_size}")
    if args.load:
        print(f"  Continuing from: {args.load}")
    print(f"  Output: {OUTPUT_DIR}")
    print("=" * 60)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Setup Environment
    train_env = make_env(seed=42, grid_size=args.grid_size)
    eval_env = make_env(seed=999, grid_size=args.grid_size)

    # 2. Setup Model
    if args.load:
        model_path = args.load
        if not os.path.exists(model_path):
            print(f"Error: Model not found at {model_path}")
            return None

        print(f"Loading pretrained model from {model_path}...")
        # Load model and reset environment
        model = DQN.load(
            model_path,
            env=train_env, # Set the training environment
            tensorboard_log=str(OUTPUT_DIR / "logs"),
            custom_objects={
                "learning_rate": 1e-4,  # Keep low LR for fine-tuning
                "exploration_fraction": 0.1, # Reduced exploration for fine-tuning
                "exploration_initial_eps": 0.3,
                "exploration_final_eps": 0.05
            }
        )
    else:
        # Network architecture: slightly larger for 28-dim input
        policy_kwargs = dict(net_arch=[256, 256])

        # Create DQN agent with tuned hyperparameters
        model = DQN(
            "MlpPolicy",
            train_env,
            learning_rate=1e-4,           # Slightly lower for stability
            buffer_size=100000,
            learning_starts=5000,         # More exploration before learning
            batch_size=128,
            tau=0.005,
            gamma=0.99,
            train_freq=4,
            gradient_steps=1,
            target_update_interval=1000,
            exploration_fraction=0.3,     # Longer exploration period
            exploration_initial_eps=1.0,
            exploration_final_eps=0.05,
            policy_kwargs=policy_kwargs,
            verbose=1,
            tensorboard_log=str(OUTPUT_DIR / "logs"),
            device="auto"
        )

    # 3. Setup Callbacks
    eval_callback = MultiSeedEvalCallback(
        eval_env=eval_env,
        target_score=args.target_score,
        n_eval_episodes=20,
        eval_freq=10000,
        save_path=OUTPUT_DIR,
        verbose=1,
    )

    # 4. Train
    print("\nStarting training...")
    print("Features: 28-dim LIDAR (8 dirs × 3 features + 4 extra)")
    print("Reward: Food=+10, Death=-10")
    print("Hunger: -0.01 base, accumulates when not approaching food\n")
    
    model.learn(
        total_timesteps=args.timesteps,
        callback=eval_callback,
        progress_bar=True,
        reset_num_timesteps=not args.load, # Don't reset timesteps if loading
    )

    # 5. Save Final Model
    model_path = OUTPUT_DIR / "snake_lidar.zip"
    model.save(str(model_path))
    print(f"✅ Model saved: {model_path}")

    # 6. Export Weights
    weights_path = OUTPUT_DIR / "snake_lidar_weights.json"
    export_weights(model, weights_path)

    # 7. Final Evaluation
    print("\n--- Final Evaluation (50 episodes) ---")
    scores = []
    lengths = []
    for seed in range(50):
        obs, _ = eval_env.reset(seed=seed * 100)
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, _, terminated, truncated, info = eval_env.step(int(action))
            done = terminated or truncated
        scores.append(info.get("score", 0))
        lengths.append(info.get("snake_length", 3))

    print(f"Score: {np.mean(scores):.1f} ± {np.std(scores):.1f}")
    print(f"Length: {np.mean(lengths):.1f} ± {np.std(lengths):.1f}")
    print(f"Min: {min(scores)}, Max: {max(scores)}")

    # 8. Deploy (if requested)
    if args.deploy:
        deploy_weights()

    return model


def deploy_weights() -> None:
    """Deploy LIDAR weights to frontend."""
    src = OUTPUT_DIR / "snake_lidar_weights.json"
    dst = SCRIPT_DIR.parent.parent / "public" / "models" / "snake" / "snake_lidar_weights.json"
    
    if not src.exists():
        print(f"❌ Source not found: {src}")
        return
    
    dst.parent.mkdir(parents=True, exist_ok=True)
    
    import shutil
    shutil.copy(src, dst)
    print(f"✅ Deployed LIDAR weights: {dst}")


def main():
    parser = argparse.ArgumentParser(description="Train Snake DQN with LIDAR Vision")
    parser.add_argument("--target-score", type=float, default=300.0,
                        help="Target average score for early stopping (default: 300)")
    parser.add_argument("--timesteps", type=int, default=1_000_000,
                        help="Maximum training timesteps (default: 1000000)")
    parser.add_argument("--grid-size", type=int, default=10,
                        help="Grid size (default: 10)")
    parser.add_argument("--load", type=str,
                        help="Path to pretrained model to continue training")
    parser.add_argument("--deploy", action="store_true",
                        help="Auto-deploy weights to frontend after training")
    
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
