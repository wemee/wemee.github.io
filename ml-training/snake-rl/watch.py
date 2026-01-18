"""
Watch the AI play Snake step by step.

Useful for debugging and understanding AI behavior.

Usage:
    python watch.py                 # Watch with default seed
    python watch.py --seed 123      # Watch with specific seed
    python watch.py --steps 50      # Watch for max 50 steps
"""

import sys
import argparse
from pathlib import Path

from stable_baselines3 import DQN

# Ensure environments package is importable
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))

from environments import SnakeEnv, Compact11Wrapper


def watch(model_path: Path, seed: int = 42, max_steps: int = 100):
    """Run one episode and watch the AI play."""
    
    if not model_path.exists():
        print(f"❌ Model not found: {model_path}")
        print("   Run train.py first.")
        return
    
    model = DQN.load(str(model_path))
    
    env = SnakeEnv(grid_width=10, grid_height=10)
    env = Compact11Wrapper(env)
    
    obs, _ = env.reset(seed=seed)
    raw_env = env.unwrapped
    
    print("=" * 50)
    print(f"WATCHING AI PLAY (seed={seed})")
    print("=" * 50)
    
    dir_names = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    step = 0
    total_reward = 0
    done = False
    
    while not done and step < max_steps:
        action, _ = model.predict(obs, deterministic=True)
        action = int(action)
        
        snake = raw_env.snake
        food = raw_env.food
        direction = raw_env.direction
        
        print(f"\n--- Step {step} ---")
        print(f"Head: {snake[0]}, Food: {food}")
        print(f"Direction: {dir_names[direction]} → Action: {dir_names[action]}")
        print(raw_env._render_ansi())
        
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        done = terminated or truncated
        
        print(f"Reward: {reward:.1f}, Total: {total_reward:.1f}")
        step += 1
    
    print("\n" + "=" * 50)
    print(f"GAME OVER at step {step}")
    print(f"Final Score: {info.get('score', 0)}")
    print(f"Apples Eaten: {info.get('score', 0) // 10}")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="Watch Snake AI Play")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed (default: 42)")
    parser.add_argument("--steps", type=int, default=100,
                        help="Maximum steps to watch (default: 100)")
    parser.add_argument("--model", type=str, default=None,
                        help="Path to model file (default: ./output/snake_dqn.zip)")
    
    args = parser.parse_args()
    
    if args.model:
        model_path = Path(args.model)
    else:
        model_path = SCRIPT_DIR / "output" / "snake_dqn.zip"
    
    watch(model_path, args.seed, args.steps)


if __name__ == "__main__":
    main()
