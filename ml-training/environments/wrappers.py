"""
Feature Extraction Wrappers for Snake Environment

These wrappers transform the raw Dict observation into different formats
for various training strategies.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any


class Compact11Wrapper(gym.ObservationWrapper):
    """
    Transform raw Snake observation into 11-dimensional feature vector.

    Features (11 total):
        [0-2] Danger detection (relative to current direction):
            - danger_straight: 1 if moving forward would cause collision
            - danger_right: 1 if turning right would cause collision
            - danger_left: 1 if turning left would cause collision

        [3-6] Current direction (one-hot):
            - dir_left, dir_right, dir_up, dir_down

        [7-10] Food relative position:
            - food_left: 1 if food.x < head.x
            - food_right: 1 if food.x > head.x
            - food_up: 1 if food.y < head.y
            - food_down: 1 if food.y > head.y

    Output: Box(shape=(11,), dtype=float32)
    """

    def __init__(self, env: gym.Env):
        super().__init__(env)
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(11,),
            dtype=np.float32
        )

        # Direction deltas: UP, DOWN, LEFT, RIGHT
        self._direction_delta = {
            0: (0, -1),   # UP
            1: (0, 1),    # DOWN
            2: (-1, 0),   # LEFT
            3: (1, 0),    # RIGHT
        }

        # Relative direction mapping (relative to current direction)
        # For each direction, what is "straight", "right", "left"
        self._relative_dirs = {
            0: {"straight": 0, "right": 3, "left": 2},  # UP: straight=UP, right=RIGHT, left=LEFT
            1: {"straight": 1, "right": 2, "left": 3},  # DOWN: straight=DOWN, right=LEFT, left=RIGHT
            2: {"straight": 2, "right": 0, "left": 1},  # LEFT: straight=LEFT, right=UP, left=DOWN
            3: {"straight": 3, "right": 1, "left": 0},  # RIGHT: straight=RIGHT, right=DOWN, left=UP
        }

    def observation(self, obs: Dict[str, Any]) -> np.ndarray:
        """Transform Dict observation to 11-dim feature vector."""
        snake = obs["snake"]
        food = obs["food"]
        direction = obs["direction"]
        grid_size = obs["grid_size"]
        snake_length = obs["snake_length"]

        # Get valid snake segments (head is at index 0)
        head = snake[0]
        valid_snake = set(tuple(snake[i]) for i in range(snake_length))

        # Initialize feature vector
        features = np.zeros(11, dtype=np.float32)

        # === Danger detection (features 0-2) ===
        rel_dirs = self._relative_dirs[direction]

        # Check danger for each relative direction
        for i, rel_name in enumerate(["straight", "right", "left"]):
            abs_dir = rel_dirs[rel_name]
            dx, dy = self._direction_delta[abs_dir]
            next_pos = (head[0] + dx, head[1] + dy)

            # Check collision
            is_danger = (
                next_pos[0] < 0 or next_pos[0] >= grid_size[0] or
                next_pos[1] < 0 or next_pos[1] >= grid_size[1] or
                next_pos in valid_snake
            )
            features[i] = 1.0 if is_danger else 0.0

        # === Current direction one-hot (features 3-6) ===
        # Order: left, right, up, down
        dir_mapping = {2: 3, 3: 4, 0: 5, 1: 6}  # LEFT=3, RIGHT=4, UP=5, DOWN=6
        features[dir_mapping[direction]] = 1.0

        # === Food relative position (features 7-10) ===
        features[7] = 1.0 if food[0] < head[0] else 0.0  # food_left
        features[8] = 1.0 if food[0] > head[0] else 0.0  # food_right
        features[9] = 1.0 if food[1] < head[1] else 0.0  # food_up
        features[10] = 1.0 if food[1] > head[1] else 0.0  # food_down

        return features


class GridFlattenWrapper(gym.ObservationWrapper):
    """
    Transform raw Snake observation into flattened grid representation.

    Output: Box(shape=(4 + grid_w * grid_h,), dtype=float32)
        - First 4: head_x, head_y, food_x, food_y (normalized)
        - Rest: flattened grid (0=empty, 1=snake, 2=food)
    """

    def __init__(self, env: gym.Env):
        super().__init__(env)

        # Get grid size from wrapped env
        grid_space = env.observation_space["grid_size"]
        self.grid_width = int(grid_space.high[0])
        self.grid_height = int(grid_space.high[1])

        obs_size = 4 + (self.grid_width * self.grid_height)
        self.observation_space = spaces.Box(
            low=0.0,
            high=2.0,
            shape=(obs_size,),
            dtype=np.float32
        )

    def observation(self, obs: Dict[str, Any]) -> np.ndarray:
        """Transform Dict observation to flattened grid."""
        snake = obs["snake"]
        food = obs["food"]
        grid_size = obs["grid_size"]
        snake_length = obs["snake_length"]

        grid_w, grid_h = grid_size[0], grid_size[1]
        head = snake[0]

        features = np.zeros(4 + grid_w * grid_h, dtype=np.float32)

        # Normalized head and food positions
        features[0] = head[0] / grid_w
        features[1] = head[1] / grid_h
        features[2] = food[0] / grid_w
        features[3] = food[1] / grid_h

        # Flattened grid
        for i in range(snake_length):
            x, y = snake[i]
            if x >= 0 and y >= 0:
                idx = 4 + y * grid_w + x
                features[idx] = 1.0

        food_idx = 4 + food[1] * grid_w + food[0]
        features[food_idx] = 2.0

        return features


class ImageWrapper(gym.ObservationWrapper):
    """
    Transform raw Snake observation into 2D image for CNN.

    Output: Box(shape=(grid_h, grid_w, 3), dtype=uint8)
        - Channel 0: Snake body (255 where snake exists)
        - Channel 1: Snake head (255 at head position)
        - Channel 2: Food (255 at food position)
    """

    def __init__(self, env: gym.Env):
        super().__init__(env)

        grid_space = env.observation_space["grid_size"]
        self.grid_width = int(grid_space.high[0])
        self.grid_height = int(grid_space.high[1])

        self.observation_space = spaces.Box(
            low=0,
            high=255,
            shape=(self.grid_height, self.grid_width, 3),
            dtype=np.uint8
        )

    def observation(self, obs: Dict[str, Any]) -> np.ndarray:
        """Transform Dict observation to RGB image."""
        snake = obs["snake"]
        food = obs["food"]
        snake_length = obs["snake_length"]

        img = np.zeros((self.grid_height, self.grid_width, 3), dtype=np.uint8)

        # Channel 0: Snake body
        for i in range(snake_length):
            x, y = snake[i]
            if x >= 0 and y >= 0:
                img[y, x, 0] = 255

        # Channel 1: Snake head
        head = snake[0]
        img[head[1], head[0], 1] = 255

        # Channel 2: Food
        img[food[1], food[0], 2] = 255

        return img
