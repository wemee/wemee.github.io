import sys
import json
from pathlib import Path
from stable_baselines3 import DQN

# Ensure environments package is importable
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))

from environments import SnakeEnv, LidarHungerWrapper

OUTPUT_DIR = Path("output")
MODEL_PATH = OUTPUT_DIR / "snake_lidar_best.zip" 
WEIGHTS_PATH = Path("../../public/models/snake/snake_lidar_weights.json")

def export_weights(model, output_path):
    params = model.q_net.state_dict()
    weights = {name: tensor.cpu().numpy().tolist() for name, tensor in params.items()}
    with open(output_path, "w") as f:
        json.dump(weights, f)
    print(f"Weights exported to {output_path}")

def main():
    if not MODEL_PATH.exists():
        print(f"Error: {MODEL_PATH} not found.")
        return

    print(f"Loading best model from {MODEL_PATH}...")
    model = DQN.load(MODEL_PATH)
    
    print("Exporting weights...")
    export_weights(model, WEIGHTS_PATH)

    print("✅ Done!")

if __name__ == "__main__":
    main()
