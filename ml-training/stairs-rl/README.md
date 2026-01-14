# Stairs Game Reinforcement Learning

This project trains an RL agent to play the "Downstairs" (小朋友下樓梯) game.

## Architecture

```
stairs-rl/
├── dist/                    # Compiled JS game core (from frontend)
│   └── StairsGameCore.js    # Built via: npm run build:rl-core
├── stairs_env.py            # Gymnasium environment wrapper
├── train.py                 # Training script (Stable Baselines3)
├── evaluate.py              # Evaluation and visualization
└── requirements.txt         # Python dependencies
```

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Build game core from frontend (run from project root)
cd ../..
npm run build:rl-core
```

## How it Works

1. **PyMiniRacer** embeds V8 JavaScript engine in Python
2. Game logic runs in V8 (same engine as Chrome/Node.js)
3. Python RL algorithms interact via `reset()` / `step()` interface
4. Trained model can be exported to TensorFlow.js for browser deployment

## Training

```bash
python train.py
```

## Key Benefits

- **100% numerical consistency** - Same V8 engine as browser
- **Single source of truth** - Game logic only in TypeScript
- **Fast iteration** - Change game rules, rebuild, retrain
