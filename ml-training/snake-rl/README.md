# Snake RL Training Module

Train a DQN agent to play Snake, with browser-compatible weight export.

## Quick Start

```bash
# 啟動虛擬環境 (使用 ml-training 根目錄的統一 venv)
cd ml-training
source venv/bin/activate

# 進入 snake-rl 目錄並訓練
cd snake-rl
python train.py

# 部署權重到前端
python deploy.py
```

## Scripts

| Script | Description |
|--------|-------------|
| `train.py` | Train DQN agent |
| `evaluate.py` | Evaluate trained model |
| `deploy.py` | Copy weights to frontend |
| `watch.py` | Watch AI play step-by-step |

## Training Options

```bash
python train.py --help

Options:
  --target-score FLOAT  Target avg score for early stopping (default: 200)
  --timesteps INT       Maximum training steps (default: 500000)
  --deploy              Auto-deploy weights after training
```

## Output Files

After training, `./output/` contains:
- `snake_dqn.zip` - Full model (for continued training)
- `snake_weights.json` - Weights only (for browser inference)

## Architecture

- **Environment**: 10x10 grid, Snake game
- **Features**: 11-dimensional Compact11Wrapper
  - [0-2] Danger detection (straight, right, left)
  - [3-6] Current direction (one-hot)
  - [7-10] Food relative position
- **Algorithm**: DQN with [128, 128] MLP
- **Target**: 200+ avg score (20+ apples)

## Frontend Integration

The browser uses `SnakeAI.ts` to run inference:
1. Extract 11 features from game state
2. Forward pass through Q-network
3. Select action with highest Q-value

Weights are loaded from `/public/models/snake/snake_weights.json`.
