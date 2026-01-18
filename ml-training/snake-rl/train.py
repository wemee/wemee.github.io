"""
Snake RL Training Script

Trains a DQN agent to play Snake using the Compact11 feature wrapper.
All outputs are saved to ./output/ relative to this script.

Usage:
    python train.py                          # Default: 500K steps, target 200 score
    python train.py --target-score 300       # Train until avg 300 score
    python train.py --timesteps 100000       # Train for exactly 100K steps
    python train.py --deploy                 # Auto-deploy weights to frontend after training
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

from environments import SnakeEnv, Compact11Wrapper

# Output directory (relative to this script)
OUTPUT_DIR = SCRIPT_DIR / "output"


class MultiSeedEvalCallback(BaseCallback):
    """
    Evaluate using multiple random seeds for accurate performance measurement.
    Stops training when average score reaches target.
    """

    def __init__(
        self,
        eval_env,
        target_score: float = 200.0,
        n_eval_episodes: int = 20,
        eval_freq: int = 10000,
        verbose: int = 1,
    ):
        super().__init__(verbose)
        self.eval_env = eval_env
        self.target_score = target_score
        self.n_eval_episodes = n_eval_episodes
        self.eval_freq = eval_freq
        self.best_mean_score = -np.inf

    def _on_step(self) -> bool:
        if self.n_calls % self.eval_freq != 0:
            return True

        # Evaluate with different seeds for each episode
        scores = []
        for episode in range(self.n_eval_episodes):
            seed = episode * 137 + 42  # Different seed per episode
            obs, _ = self.eval_env.reset(seed=seed)
            done = False
            while not done:
                action, _ = self.model.predict(obs, deterministic=True)
                obs, _, terminated, truncated, info = self.eval_env.step(int(action))
                done = terminated or truncated
            scores.append(info.get("score", 0))

        mean_score = np.mean(scores)
        std_score = np.std(scores)
        min_score = min(scores)
        max_score = max(scores)

        if mean_score > self.best_mean_score:
            self.best_mean_score = mean_score

        if self.verbose:
            print(f"\n[Eval @ {self.n_calls:,}] "
                  f"Mean: {mean_score:.1f} ± {std_score:.1f} | "
                  f"Min: {min_score} | Max: {max_score} | "
                  f"Best: {self.best_mean_score:.1f}")

        if mean_score >= self.target_score:
            print(f"\n🎯 Target score {self.target_score} reached!")
            return False

        return True


def make_env(seed: int = 0) -> Compact11Wrapper:
    """Create Snake environment with Compact11 feature wrapper."""
    env = SnakeEnv(grid_width=10, grid_height=10, max_steps=500)
    env = Compact11Wrapper(env)
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
    """Train DQN agent on Snake."""
    print("=" * 60)
    print("Snake RL Training")
    print(f"  Target Score: {args.target_score}")
    print(f"  Max Timesteps: {args.timesteps:,}")
    print(f"  Output: {OUTPUT_DIR}")
    print("=" * 60)

    # Create environments
    train_env = make_env(seed=42)
    eval_env = make_env(seed=999)

    # Create DQN agent
    model = DQN(
        "MlpPolicy",
        train_env,
        learning_rate=5e-4,
        buffer_size=100000,
        learning_starts=1000,
        batch_size=128,
        tau=0.005,
        gamma=0.99,
        train_freq=4,
        gradient_steps=1,
        target_update_interval=1000,
        exploration_fraction=0.2,
        exploration_initial_eps=1.0,
        exploration_final_eps=0.02,
        policy_kwargs=dict(net_arch=[128, 128]),
        verbose=1,
    )

    # Callback for evaluation and early stopping
    eval_callback = MultiSeedEvalCallback(
        eval_env=eval_env,
        target_score=args.target_score,
        n_eval_episodes=20,
        eval_freq=10000,
        verbose=1,
    )

    # Train
    print("\nStarting training...")
    model.learn(
        total_timesteps=args.timesteps,
        callback=eval_callback,
        progress_bar=True,
    )

    # Save outputs
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    model_path = OUTPUT_DIR / "snake_dqn.zip"
    model.save(str(model_path))
    print(f"✅ Model saved: {model_path}")

    weights_path = OUTPUT_DIR / "snake_weights.json"
    export_weights(model, weights_path)

    # Final evaluation
    print("\n--- Final Evaluation (50 episodes) ---")
    scores = []
    for seed in range(50):
        obs, _ = eval_env.reset(seed=seed * 100)
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, _, terminated, truncated, info = eval_env.step(int(action))
            done = terminated or truncated
        scores.append(info.get("score", 0))

    print(f"Average: {np.mean(scores):.1f} ± {np.std(scores):.1f}")
    print(f"Min: {min(scores)}, Max: {max(scores)}")

    # Auto-deploy if requested
    if args.deploy:
        deploy_weights()

    return model


def deploy_weights() -> None:
    """Deploy weights to frontend."""
    src = OUTPUT_DIR / "snake_weights.json"
    dst = SCRIPT_DIR.parent.parent / "public" / "models" / "snake" / "snake_weights.json"
    
    if not src.exists():
        print(f"❌ Source not found: {src}")
        return
    
    dst.parent.mkdir(parents=True, exist_ok=True)
    
    import shutil
    shutil.copy(src, dst)
    print(f"✅ Deployed weights: {dst}")


def main():
    parser = argparse.ArgumentParser(description="Train Snake DQN Agent")
    parser.add_argument("--target-score", type=float, default=200.0,
                        help="Target average score for early stopping (default: 200)")
    parser.add_argument("--timesteps", type=int, default=500_000,
                        help="Maximum training timesteps (default: 500000)")
    parser.add_argument("--deploy", action="store_true",
                        help="Auto-deploy weights to frontend after training")
    
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
