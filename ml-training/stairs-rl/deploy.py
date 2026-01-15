#!/usr/bin/env python3
"""
一鍵部署訓練好的模型到前端

使用方式：
    python deploy.py                    # 部署最新模型
    python deploy.py --model best_model # 指定模型檔案
"""

import sys
import json
import shutil
from pathlib import Path
import argparse
import subprocess


def main():
    parser = argparse.ArgumentParser(description='Deploy trained RL model to frontend')
    parser.add_argument('--model', type=str, default='final_model',
                        help='Model filename (without .zip extension)')
    parser.add_argument('--skip-git', action='store_true',
                        help='Skip git commit step')
    args = parser.parse_args()

    # 路徑設定
    project_root = Path(__file__).parent.parent.parent
    ml_dir = Path(__file__).parent
    output_dir = ml_dir / 'output'
    model_path = output_dir / 'models' / args.model
    weights_json = output_dir / 'model_weights.json'
    public_dir = project_root / 'public' / 'models' / 'stairs'

    print("=" * 60)
    print("🚀 下樓梯 RL 模型部署腳本")
    print("=" * 60)

    # 1. 檢查模型是否存在
    if not model_path.with_suffix('.zip').exists():
        print(f"\n❌ 錯誤: 找不到模型檔案 {model_path}.zip")
        print(f"   可用的模型:")
        models_dir = output_dir / 'models'
        if models_dir.exists():
            for model_file in sorted(models_dir.glob('*.zip')):
                print(f"   - {model_file.stem}")
        return 1

    print(f"\n✓ 找到模型: {model_path}.zip")

    # 2. 導出權重為 JSON
    print(f"\n📦 步驟 1/3: 導出模型權重...")
    try:
        from stable_baselines3 import PPO
        import numpy as np

        # 載入模型
        model = PPO.load(str(model_path))
        print(f"   ✓ 模型已載入")

        # 提取權重
        policy_net = model.policy.mlp_extractor.policy_net
        weights = {
            "model_info": {
                "architecture": "PPO Policy Network",
                "input_dim": 54,
                "hidden_dim": 64,
                "output_dim": 3,
                "activation": "tanh",
                "framework": "Stable Baselines3 → TF.js"
            },
            "weights": {
                "policy_layer1": {
                    "kernel": policy_net[0].weight.data.cpu().numpy().T.tolist(),
                    "bias": policy_net[0].bias.data.cpu().numpy().tolist()
                },
                "policy_layer2": {
                    "kernel": policy_net[2].weight.data.cpu().numpy().T.tolist(),
                    "bias": policy_net[2].bias.data.cpu().numpy().tolist()
                },
                "action_logits": {
                    "kernel": model.policy.action_net.weight.data.cpu().numpy().T.tolist(),
                    "bias": model.policy.action_net.bias.data.cpu().numpy().tolist()
                }
            }
        }

        # 保存 JSON
        with open(weights_json, 'w') as f:
            json.dump(weights, f, indent=2)

        file_size = weights_json.stat().st_size
        print(f"   ✓ 權重已導出: {file_size:,} bytes ({file_size/1024:.1f} KB)")

    except Exception as e:
        print(f"   ❌ 導出失敗: {e}")
        return 1

    # 3. 複製到 public 目錄
    print(f"\n📂 步驟 2/3: 部署到前端...")
    try:
        public_dir.mkdir(parents=True, exist_ok=True)
        target_file = public_dir / 'model_weights.json'
        shutil.copy2(weights_json, target_file)
        print(f"   ✓ 已複製到: {target_file.relative_to(project_root)}")

        # 驗證檔案
        if target_file.exists() and target_file.stat().st_size == weights_json.stat().st_size:
            print(f"   ✓ 檔案驗證成功")
        else:
            print(f"   ⚠️  檔案大小不一致，可能複製失敗")

    except Exception as e:
        print(f"   ❌ 部署失敗: {e}")
        return 1

    # 4. Git commit (可選)
    if not args.skip_git:
        print(f"\n📝 步驟 3/3: Git 提交...")
        try:
            # 檢查是否有變更
            result = subprocess.run(
                ['git', 'status', '--porcelain', str(target_file.relative_to(project_root))],
                cwd=project_root,
                capture_output=True,
                text=True
            )

            if result.stdout.strip():
                # 有變更，提交
                subprocess.run(
                    ['git', 'add', str(target_file.relative_to(project_root))],
                    cwd=project_root,
                    check=True
                )

                commit_msg = f"chore(rl): deploy {args.model} to frontend"
                subprocess.run(
                    ['git', 'commit', '-m', commit_msg],
                    cwd=project_root,
                    check=True
                )
                print(f"   ✓ Git 提交完成")
            else:
                print(f"   ℹ️  沒有變更需要提交")

        except subprocess.CalledProcessError as e:
            print(f"   ⚠️  Git 提交失敗: {e}")
            print(f"   提示: 你可以手動提交，或使用 --skip-git 跳過")
    else:
        print(f"\n📝 步驟 3/3: 跳過 Git 提交 (--skip-git)")

    # 完成
    print("\n" + "=" * 60)
    print("✅ 部署完成！")
    print("=" * 60)
    print(f"\n模型已部署到: public/models/stairs/model_weights.json")
    print(f"檔案大小: {file_size/1024:.1f} KB")
    print(f"\n測試方式:")
    print(f"  1. 啟動開發伺服器: npm run dev")
    print(f"  2. 訪問: http://localhost:4321/game/stairs")
    print(f"  3. 點擊「🧠 強化學習 AI」按鈕")
    print(f"\n下次部署只需執行:")
    print(f"  python deploy.py")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
