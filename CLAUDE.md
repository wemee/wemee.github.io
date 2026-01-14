# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev          # Start dev server at localhost:4321
npm run dev -- --host  # Dev server accessible on LAN (for mobile testing)
npm run build        # Build static site to dist/
npm run preview      # Preview production build locally
```

## Project Architecture

This is an Astro 5 static site (wemee.github.io) using Bootswatch Solar theme with Bootstrap 5.

### Directory Structure
- `src/pages/` - File-based routing (game/, math/, tools/, blog/)
- `src/layouts/BaseLayout.astro` - Single layout with SEO meta tags, OG tags, and JSON-LD structured data
- `src/components/Navbar.astro` - Navigation with dropdowns for each section
- `src/content/blog/` - Markdown blog posts with frontmatter schema defined in `src/content/config.ts`
- `src/lib/` - TypeScript logic separated from UI
- `public/` - Static assets served directly

### TypeScript Library Structure (`src/lib/`)
- `games/` - Game logic classes (BreakoutGame, StairsGame) with shared types and utilities
  - `core/GameCore.ts` - Abstract base class for all games (Gymnasium-compatible interface)
  - `types.ts` - Shared interfaces (Particle, GameState, KeyState)
  - `GameUtils.ts` - Shared functions (overlay, particles, drawing helpers)
  - `{GameName}Core.ts` - Pure game logic (no DOM/Canvas), extends GameCore
  - `{GameName}Game.ts` - Browser version with rendering, uses Core
- `ai/` - AI agent architecture for game playing
  - `core/Agent.ts` - Abstract base class for all AI agents
  - `core/TFJSAgent.ts` - TensorFlow.js specialized base class
  - `agents/{GameName}Agent.ts` - Concrete AI implementations (RL, rule-based, etc.)
- `math/` - Math visualization classes (VectorVisualizer, TrafficSimulator)
- `image.ts` - Image processing utilities for tools

### Key Patterns
- **BaseLayout Props**: All pages use `<BaseLayout title="..." description="...">` wrapper. For blog posts, pass `articleDate`, `articleAuthor`, and `articleTags` for proper SEO metadata
- **Path aliases**: Use `@/*` to reference `src/*` (configured in tsconfig.json)
- **Blog schema**: Posts require `title`, `pubDate`, `description` in frontmatter; `author`, `tags`, `image` optional
- **Canvas Apps**: Use class-based pattern with constructor taking canvasId and callbacks, handle devicePixelRatio for Retina displays, use requestAnimationFrame for game loops

### Canvas/Visualization Class Pattern
```typescript
class MyVisualizer {
  constructor(canvasId: string, callbacks?: { onUpdate?: (state) => void }) {
    // Get canvas, setup DPR scaling, init event listeners
  }
  private setupCanvas(): void { /* Handle devicePixelRatio */ }
  private render(): void { /* Main draw loop */ }
  public destroy(): void { /* Cleanup event listeners */ }
}
```

## Game Architecture (GameCore + AI Agents)

All games follow a **two-layer architecture** for RL training support:

### 1. GameCore Layer (Pure Logic)
- **Location**: `src/lib/games/{GameName}Core.ts`
- **Extends**: `GameCore<TObservation, TAction>` from `src/lib/games/core/GameCore.ts`
- **Purpose**: Headless game logic, no DOM/Canvas dependencies
- **Interface**: Gymnasium-compatible (`reset()`, `step()`, `getState()`)
- **Used by**: Both browser (via Game class) and Python training (via PyMiniRacer)

```typescript
export class StairsGameCore extends GameCore<StairsGameState, Action> {
  reset(): StairsGameState { /* ... */ }
  step(action: Action): StepResult<StairsGameState> { /* ... */ }
  getState(): StairsGameState { /* ... */ }
}
```

### 2. Game Layer (Browser Rendering)
- **Location**: `src/lib/games/{GameName}Game.ts`
- **Uses**: `{GameName}Core` for logic
- **Adds**: Canvas rendering, user input handling, UI updates
- **Pattern**: Delegates logic to Core, handles visualization

```typescript
export class StairsGame {
  private core: StairsGameCore;

  constructor() {
    this.core = new StairsGameCore({ /* config */ });
  }

  private update() {
    const action = this.getUserInput();
    const result = this.core.step(action);
    this.render(result.observation);
  }
}
```

### 3. AI Agent Layer
- **Location**: `src/lib/ai/agents/{GameName}Agent.ts`
- **Extends**: `TFJSAgent<TObservation, TAction>` (for RL) or `Agent<TObservation, TAction>` (for others)
- **Purpose**: Load trained models and predict actions from game state
- **Model loading**: Supports TF.js LayersModel or JSON weights

```typescript
export class StairsWeightsAgent extends TFJSAgent<StairsGameState, Action> {
  protected observationToTensor(state: StairsGameState): any {
    // Convert game state to model input
  }

  protected async tensorToAction(tensor: any): Promise<PredictionResult<Action>> {
    // Convert model output to game action
  }
}
```

### Design Principles (SOLID)
- **Single Responsibility**: Core = logic, Game = rendering, Agent = AI
- **Open-Closed**: Extend GameCore for new games, no modification needed
- **Liskov Substitution**: All GameCore subclasses are interchangeable
- **Interface Segregation**: Minimal Agent interface (load, predict, destroy)
- **Dependency Inversion**: Depend on abstractions (GameCore, Agent)

## Adding New Pages

1. Create `.astro` file in appropriate `src/pages/` subdirectory
2. Wrap content with `<BaseLayout title="Page Title" description="SEO description">`
3. **Manually update** `src/components/Navbar.astro` to add navigation link
4. Update relevant index page (`math/index.astro`, `game/index.astro`, `tools/index.astro`)

## Adding New Games/Visualizations

1. Create class in `src/lib/games/` or `src/lib/math/`
2. Use shared types from `src/lib/games/types.ts` if applicable
3. Import and instantiate in page's `<script>` block with `document.addEventListener('DOMContentLoaded', ...)`

## Deployment

Pushes to `main` branch auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. The workflow runs `npm ci && npm run build` and deploys `dist/`.

## ML Training (`ml-training/`)

Machine learning training code lives separately from the web frontend. Each project has its own subdirectory with independent Python virtual environments.

### Directory Structure
```
ml-training/
├── shared/                      # Shared training framework (reusable)
│   ├── base_trainer.py         # BaseRLTrainer (Template Method pattern)
│   └── exporters/
│       └── tfjs_exporter.py    # Model export utilities
├── mnist/                       # MNIST digit recognition
│   └── ...
└── stairs-rl/                   # Stairs game RL training
    ├── dist/StairsGameCore.js  # Compiled game core (from npm run build:rl-core)
    ├── stairs_env.py           # Gymnasium environment wrapper
    ├── train.py                # Training script (extends BaseRLTrainer)
    ├── export_weights_json.py  # Export model weights to JSON
    ├── requirements.txt        # Python dependencies
    └── output/
        ├── models/             # Trained models (.zip)
        └── model_weights.json  # Exported weights for browser
```

### Unified Training Framework

All RL training projects follow the **Template Method pattern** via `BaseRLTrainer`:

```python
# ml-training/{game}-rl/train.py
from shared.base_trainer import BaseRLTrainer

class GameRLTrainer(BaseRLTrainer):
    def create_model(self, env):
        # Create RL algorithm (PPO, DQN, etc.)
        return PPO("MlpPolicy", env, ...)

    def export_tfjs(self, model_path, tfjs_path):
        # Export trained model to TF.js format
        pass

trainer = GameRLTrainer(env_id='Game-v0', output_dir='output')
trainer.train(total_timesteps=500_000, callbacks=[...])
trainer.evaluate(n_episodes=10)
```

### Game-Specific Components

For each new game, create:

1. **Gymnasium Environment** (`{game}_env.py`):
```python
import gymnasium as gym
from py_mini_racer import MiniRacer

class GameEnv(gym.Env):
    def __init__(self):
        self.ctx = MiniRacer()
        # Load compiled GameCore.js
        self.ctx.eval(open('dist/GameCore.js').read())

    def reset(self): ...
    def step(self, action): ...
    def _get_obs(self): ...  # Convert JS state to numpy array
```

2. **Training Script** (`train.py`): Extends `BaseRLTrainer`

3. **Export Script** (`export_weights_json.py`): Extract policy weights to JSON

### Build Commands

```bash
# 1. Build game core for Python training (add to package.json scripts)
npm run build:rl-core  # or build:{game}-core

# 2. Setup Python environment
cd ml-training/{game}-rl
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3. Train model
python train.py --timesteps 500000 --n-envs 4

# 4. Export weights for browser
python export_weights_json.py

# 5. Copy weights to public directory
cp output/model_weights.json ../../public/models/{game}/
```

### Key Principles

1. **Single Source of Truth**: Game logic lives **only in TypeScript** (`{Game}Core.ts`)
2. **100% Consistency**: Python uses PyMiniRacer (V8) to run identical JS code
3. **Gymnasium Standard**: All environments follow OpenAI Gym/Gymnasium interface
4. **Template Method**: Unified training flow, game-specific logic in subclasses
5. **JSON Weights**: Simple export format, manual model construction in browser

### Adding RL Training to a New Game

Follow these steps to add RL training support to a new game:

#### 1. Frontend (TypeScript)

**a. Create GameCore** (`src/lib/games/{Game}Core.ts`):
```typescript
import { GameCore, type GameObservation, type StepResult } from './core/GameCore';

export interface GameState extends GameObservation {
  // Define game state (player, obstacles, score, etc.)
}

export type Action = 'left' | 'right' | 'jump' | ...;

export class GameCore extends GameCore<GameState, Action> {
  reset(): GameState { /* Initialize game */ }
  step(action: Action): StepResult<GameState> {
    // Update game logic, return {observation, reward, terminated, truncated, info}
  }
  getState(): GameState { /* Return current state */ }
}
```

**b. Refactor existing Game** (`src/lib/games/{Game}Game.ts`):
```typescript
export class Game {
  private core: GameCore;

  constructor() {
    this.core = new GameCore({ /* config */ });
  }

  private update() {
    const action = this.getUserInput();
    const result = this.core.step(action);
    this.render(result.observation);
  }
}
```

**c. Create AI Agent** (`src/lib/ai/agents/{Game}WeightsAgent.ts`):
- Extend `TFJSAgent<GameState, Action>`
- Implement `observationToTensor()`: Convert state to model input
- Implement `tensorToAction()`: Convert model output to action
- Override `load()` to build model from JSON weights

**d. Add build script** to `package.json`:
```json
{
  "scripts": {
    "build:{game}-core": "esbuild src/lib/games/{Game}Core.ts --bundle --format=iife --global-name={Game}Core --outfile=ml-training/{game}-rl/dist/{Game}Core.js"
  }
}
```

#### 2. Training (Python)

**a. Create directory**: `ml-training/{game}-rl/`

**b. Create Gymnasium environment** (`{game}_env.py`):
```python
import gymnasium as gym
from py_mini_racer import MiniRacer
import numpy as np
import json

class GameEnv(gym.Env):
    def __init__(self):
        self.ctx = MiniRacer()
        # Load and unwrap compiled GameCore
        code = open('dist/{Game}Core.js').read()
        self.ctx.eval(code)
        self.ctx.eval("const GameCoreClass = {Game}Core.{Game}Core;")
        self.ctx.eval("const game = new GameCoreClass();")

        # Define action and observation spaces
        self.action_space = spaces.Discrete(3)  # Adjust based on game
        self.observation_space = spaces.Box(low=-np.inf, high=np.inf, shape=(N,))

    def reset(self, seed=None, options=None):
        state_json = self.ctx.eval("JSON.stringify(game.reset())")
        state = json.loads(state_json)
        return self._get_obs(state), {}

    def step(self, action):
        action_str = self._action_map[action]
        result_json = self.ctx.eval(f"JSON.stringify(game.step('{action_str}'))")
        result = json.loads(result_json)
        obs = self._get_obs(result['observation'])
        return obs, result['reward'], result['terminated'], result['truncated'], result.get('info', {})

    def _get_obs(self, state):
        # Convert JS state dict to numpy array
        obs = np.zeros(N, dtype=np.float32)
        # ... fill observation array ...
        return obs
```

**c. Register environment** in `{game}_env.py`:
```python
from gymnasium.envs.registration import register

register(
    id='{Game}-v0',
    entry_point='{game}_env:GameEnv',
    max_episode_steps=10000,
)
```

**d. Create training script** (`train.py`):
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))

from base_trainer import BaseRLTrainer
from stable_baselines3 import PPO
import {game}_env  # Register environment

class GameRLTrainer(BaseRLTrainer):
    def create_model(self, env):
        return PPO("MlpPolicy", env, learning_rate=3e-4, verbose=1, ...)

    def export_tfjs(self, model_path, tfjs_path):
        print("Use export_weights_json.py instead")

trainer = GameRLTrainer(env_id='{Game}-v0', output_dir='output')
trainer.train(total_timesteps=500_000, n_envs=4)
trainer.evaluate(n_episodes=10)
```

**e. Create export script** (`export_weights_json.py`):
- Load trained model from `output/models/final_model.zip`
- Extract policy network weights (layer by layer)
- Save to JSON: `output/model_weights.json`
- Copy to `public/models/{game}/`

**f. Create requirements.txt**:
```
mini-racer>=0.12.0
gymnasium>=0.29.0
stable-baselines3>=2.2.0
torch>=2.0.0
numpy>=1.24.0
tensorboard>=2.14.0
```

#### 3. Integration

**a. Add TF.js to page** (`src/pages/game/{game}.astro`):
```astro
<script is:inline src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
```

**b. Add RL AI button and script**:
```astro
<button id="rlAiStartBtn">🧠 強化學習 AI</button>

<script>
  import { GameWeightsAgent } from '@/lib/ai/agents/{Game}WeightsAgent';

  const agent = new GameWeightsAgent({ weightsPath: '/models/{game}/model_weights.json' });
  await agent.load();

  // Use agent.predict(state) in game loop
</script>
```

#### 4. Workflow

1. Build game core: `npm run build:{game}-core`
2. Train model: `cd ml-training/{game}-rl && python train.py`
3. Export weights: `python export_weights_json.py`
4. Test in browser: `npm run dev`

This architecture ensures all games follow the same pattern, making RL training straightforward and consistent.

