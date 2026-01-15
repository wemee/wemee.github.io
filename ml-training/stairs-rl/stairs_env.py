"""
Stairs Game Gymnasium Environment

Uses PyMiniRacer to run the actual game logic in V8,
ensuring 100% numerical consistency with the browser version.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from pathlib import Path

try:
    from py_mini_racer import MiniRacer
except ImportError:
    raise ImportError(
        "MiniRacer not installed. Run: pip install mini-racer"
    )


class StairsEnv(gym.Env):
    """
    Gymnasium environment for the Stairs game.

    Action Space: Discrete(3)
        0 = left
        1 = right
        2 = none (no movement)

    Observation Space: Dict containing:
        - player_x: float (0-1, normalized)
        - player_y: float (0-1, normalized)
        - player_vx: float (normalized velocity)
        - player_vy: float (normalized velocity)
        - stairs: array of stair info (x, y, width, type)
        - scroll_speed: float
    """

    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 60}

    def __init__(self, render_mode=None, max_steps=10000):
        super().__init__()

        self.render_mode = render_mode
        self.max_steps = max_steps
        self.current_step = 0

        # Load game core JavaScript
        js_path = Path(__file__).parent / "dist" / "StairsGameCore.js"
        if not js_path.exists():
            raise FileNotFoundError(
                f"Game core not found at {js_path}. "
                "Run 'npm run build:rl-core' from project root."
            )

        # Initialize V8 context
        self.ctx = MiniRacer()
        self.ctx.eval(js_path.read_text())
        # esbuild IIFE format wraps exports, need to unwrap
        self.ctx.eval("const StairsGameCoreClass = StairsGameCore.StairsGameCore;")
        self.ctx.eval("const game = new StairsGameCoreClass();")

        # Define action space
        self.action_space = spaces.Discrete(3)

        # Define observation space
        # Using flattened observation for simplicity
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(54,),  # player(4) + stairs(10 * 5)
            dtype=np.float32
        )

        self._action_map = ['left', 'right', 'none']

    def _get_state_dict(self):
        """Get game state as Python dict via JSON serialization."""
        import json
        state_json = self.ctx.eval("JSON.stringify(game.getState())")
        return json.loads(state_json)

    def _get_obs(self):
        """Get current observation from game state.

        CRITICAL: Only include stairs BELOW the player (y >= player.y),
        as stairs above are unreachable in a falling game.
        Sorted by distance (closest first) for stable representation.
        """
        state = self._get_state_dict()

        # Normalize player position (canvas is 400x600)
        obs = np.zeros(54, dtype=np.float32)
        obs[0] = state['player']['x'] / 400.0
        obs[1] = state['player']['y'] / 600.0
        obs[2] = state['player']['vx'] / 10.0
        obs[3] = state['player']['vy'] / 20.0

        # **CRITICAL FIX**: Only include stairs below player (y >= player.y)
        # Stairs above are irrelevant in a downward-falling game
        player_y = state['player']['y']
        stairs_below = [s for s in state['stairs'] if s['y'] >= player_y]

        # Sort by distance (closest first)
        stairs_below = sorted(stairs_below, key=lambda s: s['y'] - player_y)[:10]

        for i, stair in enumerate(stairs_below):
            base = 4 + i * 5
            # Encode relative position for better learning
            obs[base] = (stair['x'] - state['player']['x']) / 400.0  # Relative X
            obs[base + 1] = (stair['y'] - state['player']['y']) / 600.0  # Relative Y (always >= 0)
            obs[base + 2] = stair['width'] / 120.0
            obs[base + 3] = 1.0 if stair['broken'] else 0.0
            # Encode type: normal=0, bounce=1, fragile=2, moving=3
            type_map = {'normal': 0, 'bounce': 1, 'fragile': 2, 'moving': 3}
            obs[base + 4] = type_map.get(stair['type'], 0) / 3.0

        return obs

    def _get_info(self):
        """Get additional info."""
        state = self._get_state_dict()
        return {
            'score': state['score'],
            'scroll_speed': state['scrollSpeed']
        }

    def reset(self, seed=None, options=None):
        """Reset the environment."""
        super().reset(seed=seed)

        if seed is not None:
            self.ctx.eval(f"game.setSeed({seed})")

        self.ctx.eval("game.reset()")
        self.current_step = 0

        return self._get_obs(), self._get_info()

    def step(self, action):
        """Execute one step in the environment."""
        import json
        action_str = self._action_map[action]
        result_json = self.ctx.eval(f"JSON.stringify(game.step('{action_str}'))")
        result = json.loads(result_json)

        self.current_step += 1

        obs = self._get_obs()
        reward = result['reward']
        terminated = result['terminated']
        truncated = self.current_step >= self.max_steps
        info = self._get_info()

        return obs, reward, terminated, truncated, info

    def render(self):
        """Render is not implemented for headless training."""
        pass

    def close(self):
        """Clean up resources."""
        self.ctx = None


# Register environment
gym.register(
    id='Stairs-v0',
    entry_point='stairs_env:StairsEnv',
    max_episode_steps=10000,
)
