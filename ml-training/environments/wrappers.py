"""
Feature Extraction Wrappers for Snake Environment

These wrappers transform the raw Dict observation into different formats
for various training strategies.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any, Tuple


class LidarHungerWrapper(gym.Wrapper):
    """
    Advanced Snake wrapper with 8-directional LIDAR vision and hunger penalty.
    
    This wrapper provides:
    1. 8-directional ray casting (LIDAR) with normalized distances
    2. Hunger penalty to prevent looping behavior
    3. Distance-based reward shaping (closer to food = small reward)
    
    Features (28 total):
        [0-7]   Distance to obstacle in 8 directions (normalized 0-1)
                Directions: UP, DOWN, LEFT, RIGHT, UP-LEFT, UP-RIGHT, DOWN-LEFT, DOWN-RIGHT
        [8-15]  Is obstacle a wall? (0 or 1) for each of 8 directions
        [16-23] Is food visible in this direction? (0 or 1) for each direction
        [24]    Snake length (normalized by max possible length)
        [25]    Steps since last food (hunger, normalized)
        [26]    Food distance X (normalized, signed: -1 to 1)
        [27]    Food distance Y (normalized, signed: -1 to 1)
    
    Output: Box(shape=(28,), dtype=float32)
    """
    
    # 8 directions: UP, DOWN, LEFT, RIGHT, UP-LEFT, UP-RIGHT, DOWN-LEFT, DOWN-RIGHT
    DIRECTIONS = [
        (0, -1),   # UP
        (0, 1),    # DOWN
        (-1, 0),   # LEFT
        (1, 0),    # RIGHT
        (-1, -1),  # UP-LEFT
        (1, -1),   # UP-RIGHT
        (-1, 1),   # DOWN-LEFT
        (1, 1),    # DOWN-RIGHT
    ]
    
    def __init__(
        self, 
        env: gym.Env,
        hunger_penalty: float = -0.01,
        food_approach_reward: float = 0.1,
        max_hunger_steps: int = 100,
    ):
        """
        Args:
            env: The Snake environment to wrap
            hunger_penalty: Penalty per step without eating (default: -0.01)
            food_approach_reward: Reward for moving closer to food (default: 0.1)
            max_hunger_steps: Steps before max hunger penalty kicks in (default: 100)
        """
        super().__init__(env)
        
        self.hunger_penalty = hunger_penalty
        self.food_approach_reward = food_approach_reward
        self.max_hunger_steps = max_hunger_steps
        
        # State tracking
        self.steps_since_food = 0
        self.prev_food_distance = None
        
        # Observation space: 28 features
        self.observation_space = spaces.Box(
            low=-1.0,
            high=1.0,
            shape=(28,),
            dtype=np.float32
        )
    
    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self.steps_since_food = 0
        self.prev_food_distance = self._calculate_food_distance(obs)
        return self._extract_features(obs), info
    
    def step(self, action):
        obs, reward, terminated, truncated, info = self.env.step(action)
        
        # Calculate food distance
        current_food_distance = self._calculate_food_distance(obs)
        
        # === Reward Shaping ===
        shaped_reward = reward
        
        # 1. Hunger penalty (per step)
        hunger_factor = min(self.steps_since_food / self.max_hunger_steps, 1.0)
        shaped_reward += self.hunger_penalty * (1 + hunger_factor)  # Increases over time
        
        # 2. Food approach reward
        if self.prev_food_distance is not None:
            distance_delta = self.prev_food_distance - current_food_distance
            if distance_delta > 0:
                # Got closer to food
                shaped_reward += self.food_approach_reward
            elif distance_delta < 0:
                # Moved away from food
                shaped_reward -= self.food_approach_reward * 0.5
        
        # Update state
        if reward > 0:  # Ate food
            self.steps_since_food = 0
        else:
            self.steps_since_food += 1
        
        self.prev_food_distance = current_food_distance
        
        return self._extract_features(obs), shaped_reward, terminated, truncated, info
    
    def _calculate_food_distance(self, obs: Dict[str, Any]) -> float:
        """Calculate Manhattan distance to food."""
        head = obs["snake"][0]
        food = obs["food"]
        return abs(head[0] - food[0]) + abs(head[1] - food[1])
    
    def _extract_features(self, obs: Dict[str, Any]) -> np.ndarray:
        """Extract 28-dimensional feature vector."""
        snake = obs["snake"]
        food = obs["food"]
        grid_size = obs["grid_size"]
        snake_length = obs["snake_length"]
        
        grid_w, grid_h = grid_size[0], grid_size[1]
        max_distance = max(grid_w, grid_h)
        head = snake[0]
        
        # Build snake body set (excluding head for collision check)
        snake_body = set()
        for i in range(1, snake_length):
            x, y = snake[i]
            if x >= 0:
                snake_body.add((x, y))
        
        features = np.zeros(28, dtype=np.float32)
        
        # === LIDAR: 8 directions ===
        for i, (dx, dy) in enumerate(self.DIRECTIONS):
            distance, hit_wall, found_food = self._cast_ray(
                head, dx, dy, grid_w, grid_h, snake_body, food
            )
            
            # Normalize distance (0 = adjacent, 1 = far)
            features[i] = distance / max_distance
            
            # Is it a wall? (vs snake body)
            features[8 + i] = 1.0 if hit_wall else 0.0
            
            # Food in this direction?
            features[16 + i] = 1.0 if found_food else 0.0
        
        # === Additional features ===
        # Snake length (normalized)
        max_possible_length = grid_w * grid_h
        features[24] = snake_length / max_possible_length
        
        # Hunger (steps since food, normalized)
        features[25] = min(self.steps_since_food / self.max_hunger_steps, 1.0)
        
        # Food relative position (normalized, signed)
        features[26] = (food[0] - head[0]) / grid_w  # X: negative=left, positive=right
        features[27] = (food[1] - head[1]) / grid_h  # Y: negative=up, positive=down
        
        return features
    
    def _cast_ray(
        self,
        start: Tuple[int, int],
        dx: int,
        dy: int,
        grid_w: int,
        grid_h: int,
        snake_body: set,
        food: np.ndarray,
    ) -> Tuple[float, bool, bool]:
        """
        Cast a ray from start position in direction (dx, dy).
        
        Returns:
            distance: Distance to first obstacle
            hit_wall: True if obstacle is wall, False if snake body
            found_food: True if food is along this ray (before obstacle)
        """
        x, y = start[0], start[1]
        distance = 0
        found_food = False
        
        while True:
            x += dx
            y += dy
            distance += 1
            
            # Check if food is at this position
            if x == food[0] and y == food[1]:
                found_food = True
            
            # Check wall collision
            if x < 0 or x >= grid_w or y < 0 or y >= grid_h:
                return distance, True, found_food  # Hit wall
            
            # Check snake body collision
            if (x, y) in snake_body:
                return distance, False, found_food  # Hit snake
        
        # Should never reach here
        return distance, True, found_food


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
