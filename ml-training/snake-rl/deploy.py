"""
Deploy Snake RL weights to frontend.

Copies trained weights from ./output/snake_weights.json to the public assets.

Usage:
    python deploy.py
"""

import shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR / "output"


def deploy():
    """Deploy weights to frontend public folder."""
    src = OUTPUT_DIR / "snake_weights.json"
    dst = SCRIPT_DIR.parent.parent / "public" / "models" / "snake" / "snake_weights.json"
    
    if not src.exists():
        print(f"❌ Source not found: {src}")
        print("   Run train.py first to generate weights.")
        return False
    
    # Ensure destination directory exists
    dst.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy weights
    shutil.copy(src, dst)
    
    print("✅ Weights deployed successfully!")
    print(f"   From: {src}")
    print(f"   To:   {dst}")
    
    # Show file size
    size_kb = src.stat().st_size / 1024
    print(f"   Size: {size_kb:.1f} KB")
    
    return True


if __name__ == "__main__":
    deploy()
