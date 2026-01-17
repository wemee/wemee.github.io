"""
Snake Game Gymnasium Environment

Pure Python implementation for efficient RL training.

IMPORTANT: This environment outputs RAW game state as a Dict observation.
Use Gymnasium Wrappers (e.g., Compact11Wrapper) to transform observations
for specific training strategies.

Observation Space (Dict):
    - snake: np.ndarray, shape=(max_snake_length, 2), dtype=int32
        Array of (x, y) coordinates. **snake[0] is the HEAD**.
        Unused slots are filled with (-1, -1).
    - food: np.ndarray, shape=(2,), dtype=int32
        Food position (x, y).
    - direction: int (0=UP, 1=DOWN, 2=LEFT, 3=RIGHT)
        Current movement direction.
    - grid_size: np.ndarray, shape=(2,), dtype=int32
        (grid_width, grid_height).
    - snake_length: int
        Current snake length (number of valid segments).

Action Space: Discrete(4)
    0 = UP
    1 = DOWN
    2 = LEFT
    3 = RIGHT
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Optional, Tuple, Dict, Any


class SnakeEnv(gym.Env):
    """
    Snake Game Gymnasium Environment.

    This environment provides RAW game state. Use wrappers for feature extraction.
    See module docstring for observation space details.

    Example:
        >>> env = SnakeEnv()
        >>> obs, info = env.reset()
        >>> print(obs["snake"][0])  # Snake HEAD position
        >>> print(obs["food"])       # Food position
    """

    metadata = {"render_modes": ["human", "ansi"], "render_fps": 10}

    def __init__(
        self,
        render_mode: Optional[str] = None,
        grid_width: int = 20,
        grid_height: int = 20,
        max_steps: int = 1000,
        max_snake_length: int = 100,
    ):
        super().__init__()

        self.render_mode = render_mode
        self.grid_width = grid_width
        self.grid_height = grid_height
        self.max_steps = max_steps
        self.max_snake_length = max_snake_length
        self.current_step = 0

        # Action space: 0=UP, 1=DOWN, 2=LEFT, 3=RIGHT
        self.action_space = spaces.Discrete(4)

        # Observation space: Dict with raw game state
        self.observation_space = spaces.Dict({
            "snake": spaces.Box(
                low=-1,
                high=max(grid_width, grid_height),
                shape=(max_snake_length, 2),
                dtype=np.int32
            ),
            "food": spaces.Box(
                low=0,
                high=max(grid_width, grid_height),
                shape=(2,),
                dtype=np.int32
            ),
            "direction": spaces.Discrete(4),
            "grid_size": spaces.Box(
                low=1,
                high=max(grid_width, grid_height),
                shape=(2,),
                dtype=np.int32
            ),
            "snake_length": spaces.Discrete(max_snake_length + 1),
        })

        # Direction mapping
        self._action_to_direction = {
            0: (0, -1),   # UP
            1: (0, 1),    # DOWN
            2: (-1, 0),   # LEFT
            3: (1, 0),    # RIGHT
        }

        self._opposite_action = {
            0: 1,  # UP -> DOWN
            1: 0,  # DOWN -> UP
            2: 3,  # LEFT -> RIGHT
            3: 2,  # RIGHT -> LEFT
        }

        # Game state
        self.snake: list = []
        self.food: Tuple[int, int] = (0, 0)
        self.direction: int = 3  # Start moving RIGHT
        self.score: int = 0
        self.game_over: bool = False

        # Random generator
        self._np_random: Optional[np.random.Generator] = None

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Reset the environment to initial state."""
        super().reset(seed=seed)
        self._np_random = np.random.default_rng(seed)

        self.current_step = 0
        self.score = 0
        self.game_over = False
        self.direction = 3  # RIGHT

        # Initialize snake in center
        start_x = self.grid_width // 2
        start_y = self.grid_height // 2
        self.snake = [
            (start_x, start_y),
            (start_x - 1, start_y),
            (start_x - 2, start_y),
        ]

        # Spawn food
        self._spawn_food()

        return self._get_obs(), self._get_info()

    def step(self, action: int) -> Tuple[Dict[str, Any], float, bool, bool, Dict[str, Any]]:
        """Execute one step in the environment."""
        if self.game_over:
            return self._get_obs(), 0.0, True, False, self._get_info()

        self.current_step += 1

        # Prevent 180-degree turns
        if action != self._opposite_action.get(self.direction, -1):
            self.direction = action

        # Calculate new head position
        dx, dy = self._action_to_direction[self.direction]
        head_x, head_y = self.snake[0]
        new_head = (head_x + dx, head_y + dy)

        # Check collision
        if self._check_collision(new_head):
            self.game_over = True
            return self._get_obs(), -10.0, True, False, self._get_info()

        # Move snake
        self.snake.insert(0, new_head)

        # Check food
        reward = 0.0
        if new_head == self.food:
            self.score += 10
            reward = 10.0
            self._spawn_food()
        else:
            self.snake.pop()

        # Check truncation
        truncated = self.current_step >= self.max_steps

        return self._get_obs(), reward, False, truncated, self._get_info()

    def _check_collision(self, pos: Tuple[int, int]) -> bool:
        """Check if position collides with wall or snake body."""
        x, y = pos

        # Wall collision
        if x < 0 or x >= self.grid_width or y < 0 or y >= self.grid_height:
            return True

        # Self collision (exclude tail as it will move)
        if pos in self.snake[:-1]:
            return True

        return False

    def _spawn_food(self) -> None:
        """Spawn food at random empty position."""
        occupied = set(self.snake)
        available = [
            (x, y)
            for x in range(self.grid_width)
            for y in range(self.grid_height)
            if (x, y) not in occupied
        ]

        if available:
            idx = self._np_random.integers(0, len(available))
            self.food = available[idx]

    def _get_obs(self) -> Dict[str, Any]:
        """
        Get current observation as Dict.

        Returns:
            Dict with keys: snake, food, direction, grid_size, snake_length.
            Note: snake[0] is always the HEAD.
        """
        # Build snake array with padding
        snake_arr = np.full((self.max_snake_length, 2), -1, dtype=np.int32)
        for i, (x, y) in enumerate(self.snake):
            if i >= self.max_snake_length:
                break
            snake_arr[i] = [x, y]

        return {
            "snake": snake_arr,
            "food": np.array(self.food, dtype=np.int32),
            "direction": self.direction,
            "grid_size": np.array([self.grid_width, self.grid_height], dtype=np.int32),
            "snake_length": len(self.snake),
        }

    def _get_info(self) -> Dict[str, Any]:
        """Get additional info."""
        return {
            "score": self.score,
            "snake_length": len(self.snake),
        }

    def render(self) -> Optional[str]:
        """Render the environment."""
        if self.render_mode == "ansi":
            return self._render_ansi()
        return None

    def _render_ansi(self) -> str:
        """Render as ASCII art."""
        grid = [["." for _ in range(self.grid_width)] for _ in range(self.grid_height)]

        # Draw snake (O=head, o=body)
        for i, (x, y) in enumerate(self.snake):
            grid[y][x] = "O" if i == 0 else "o"

        # Draw food
        fx, fy = self.food
        grid[fy][fx] = "*"

        # Build string
        border = "+" + "-" * self.grid_width + "+"
        lines = [border]
        for row in grid:
            lines.append("|" + "".join(row) + "|")
        lines.append(border)
        lines.append(f"Score: {self.score}  Length: {len(self.snake)}")

        return "\n".join(lines)

    def close(self) -> None:
        """Clean up resources."""
        pass

