"""
Stairs Game RL Training Script

Uses Stable Baselines3 to train a PPO agent.
"""

import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
from pathlib import Path

# Import our custom environment
import stairs_env  # This registers Stairs-v0


def main():
    # Create output directories
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    log_dir = output_dir / "logs"
    log_dir.mkdir(exist_ok=True)

    model_dir = output_dir / "models"
    model_dir.mkdir(exist_ok=True)

    print("Creating environment...")

    # Create vectorized environment for parallel training
    # Note: PyMiniRacer creates separate V8 isolates per env
    env = make_vec_env('Stairs-v0', n_envs=4)

    # Create evaluation environment
    eval_env = gym.make('Stairs-v0')

    print("Setting up PPO agent...")

    # PPO hyperparameters tuned for game-like environments
    model = PPO(
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
        tensorboard_log=str(log_dir),
    )

    # Callbacks
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=str(model_dir),
        log_path=str(log_dir),
        eval_freq=10000,
        deterministic=True,
        render=False,
    )

    checkpoint_callback = CheckpointCallback(
        save_freq=50000,
        save_path=str(model_dir),
        name_prefix="stairs_ppo",
    )

    print("Starting training...")
    print("Monitor with: tensorboard --logdir", log_dir)

    # Train
    model.learn(
        total_timesteps=1_000_000,
        callback=[eval_callback, checkpoint_callback],
        progress_bar=True,
    )

    # Save final model
    final_path = model_dir / "stairs_ppo_final"
    model.save(str(final_path))
    print(f"Training complete! Model saved to {final_path}")

    # Cleanup
    env.close()
    eval_env.close()


if __name__ == "__main__":
    main()
