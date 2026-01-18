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

Our architecture decouples training logic from inference, allowing fast Python training and lightweight browser deployment.

### 1. Training (Backend)
- **Environment**: Gymnasium-compatible `SnakeEnv`.
- **Observation Space**:
  - **LIDAR (28-dim)**: 8-directional raycasting for distance/wall/food detection. (New standard)
  - **Compact11 (11-dim)**: Legacy simple vision.
- **Algorithm**: Stable-Baselines3 DQN with MLP Policy.

### 2. Inference (Frontend)
- **Engine**: Pure TypeScript matrix math (no TF.js/ONNX runtime needed).
- **Design Pattern**: **Strategy Pattern** for feature extraction.
  - `SnakeAI` (Context) uses `FeatureExtractor` (Interface).
  - Implementations: `LidarExtractor` & `Compact11Extractor`.
- **Weights**: JSON format (weights & biases only).

## Frontend Integration

The browser uses `SnakeAI.ts` to run inference:

```typescript
// Load Lidar-based AI (Default)
const ai = new SnakeAI({ extractor: new LidarExtractor() });
await ai.load('/models/snake/snake_lidar_weights.json');

// Load Legacy AI
const legacyAi = new SnakeAI({ extractor: new Compact11Extractor() });
await legacyAi.load('/models/snake/snake_weights.json');
```

1. **Extract Features**: Convert game state to normalized array (using Strategy).
2. **Forward Pass**: Run MLP inference using loaded JSON weights.
3. **Action**: Choose argmax(Q-values).
3. Select action with highest Q-value

Weights are loaded from `/public/models/snake/snake_weights.json`.
