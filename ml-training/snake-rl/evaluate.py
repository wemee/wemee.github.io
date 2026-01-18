"""
Snake RL Evaluation Script

Evaluate a trained model across multiple random seeds.

Usage:
    python evaluate.py                    # Evaluate default model
    python evaluate.py --model custom.zip # Evaluate specific model
    python evaluate.py --episodes 100     # Run 100 evaluation episodes
"""

import sys
import argparse
from pathlib import Path

import numpy as np
from stable_baselines3 import DQN

# Ensure environments package is importable
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))

from environments import SnakeEnv, Compact11Wrapper


def make_env() -> Compact11Wrapper:
    """Create Snake environment with Compact11 feature wrapper."""
    env = SnakeEnv(grid_width=10, grid_height=10, max_steps=500)
    env = Compact11Wrapper(env)
    return env


def evaluate(model_path: Path, n_episodes: int = 50, verbose: bool = True) -> dict:
    """
    Evaluate model across multiple random seeds.
    
    Returns:
        dict with 'mean', 'std', 'min', 'max', 'scores'
    """
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    
    model = DQN.load(str(model_path))
    env = make_env()
    
    scores = []
    for episode in range(n_episodes):
        seed = episode * 137 + 1  # Different seed per episode
        obs, _ = env.reset(seed=seed)
        done = False
        
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, _, terminated, truncated, info = env.step(int(action))
            done = terminated or truncated
        
        score = info.get("score", 0)
        scores.append(score)
        
        if verbose and (episode + 1) % 10 == 0:
            print(f"  Episode {episode + 1}/{n_episodes}: Score = {score}")
    
    results = {
        "mean": np.mean(scores),
        "std": np.std(scores),
        "min": min(scores),
        "max": max(scores),
        "scores": scores,
    }
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Evaluate Snake DQN Agent")
    parser.add_argument("--model", type=str, default=None,
                        help="Path to model file (default: ./output/snake_dqn.zip)")
    parser.add_argument("--episodes", type=int, default=50,
                        help="Number of evaluation episodes (default: 50)")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-episode output")
    
    args = parser.parse_args()
    
    # Determine model path
    if args.model:
        model_path = Path(args.model)
    else:
        model_path = SCRIPT_DIR / "output" / "snake_dqn.zip"
    
    print("=" * 60)
    print("Snake RL Evaluation")
    print(f"  Model: {model_path}")
    print(f"  Episodes: {args.episodes}")
    print("=" * 60)
    
    results = evaluate(model_path, args.episodes, verbose=not args.quiet)
    
    print("\n" + "=" * 60)
    print("Results")
    print("=" * 60)
    print(f"  Mean Score: {results['mean']:.1f} ± {results['std']:.1f}")
    print(f"  Min: {results['min']}, Max: {results['max']}")
    print(f"  Apples (avg): {results['mean'] / 10:.1f}")


if __name__ == "__main__":
    main()
