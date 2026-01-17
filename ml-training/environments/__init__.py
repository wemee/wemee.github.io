"""
WeMee Game Environments for Gymnasium

A collection of Gymnasium environments for RL training.
"""

from gymnasium.envs.registration import register

# Register Snake environment
register(
    id='Snake-v0',
    entry_point='environments.snake_env:SnakeEnv',
    max_episode_steps=1000,
)

# Re-export for convenience
from environments.snake_env import SnakeEnv
from environments.wrappers import Compact11Wrapper, GridFlattenWrapper, ImageWrapper

__all__ = [
    'SnakeEnv',
    'Compact11Wrapper',
    'GridFlattenWrapper',
    'ImageWrapper',
]
