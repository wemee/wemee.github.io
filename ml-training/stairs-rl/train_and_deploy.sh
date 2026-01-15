#!/bin/bash
# 一鍵訓練並部署模型
#
# 使用方式:
#   ./train_and_deploy.sh                # 使用預設參數 (10K steps)
#   ./train_and_deploy.sh 50000          # 指定訓練步數
#   ./train_and_deploy.sh 50000 8        # 指定步數和並行環境數

set -e  # 遇到錯誤立即停止

# 參數設定
TIMESTEPS=${1:-10000}
N_ENVS=${2:-4}
EVAL_FREQ=${3:-2000}

echo "=================================="
echo "🚀 下樓梯 RL 訓練 + 部署流程"
echo "=================================="
echo "訓練步數: $TIMESTEPS"
echo "並行環境: $N_ENVS"
echo "評估頻率: $EVAL_FREQ"
echo ""

# 1. 訓練模型
echo "📚 步驟 1/2: 訓練模型..."
python train.py --timesteps "$TIMESTEPS" --n-envs "$N_ENVS" --eval-freq "$EVAL_FREQ"

if [ $? -ne 0 ]; then
    echo "❌ 訓練失敗"
    exit 1
fi

echo ""
echo "✅ 訓練完成！"
echo ""

# 2. 部署模型
echo "📦 步驟 2/2: 部署模型到前端..."
python deploy.py

if [ $? -ne 0 ]; then
    echo "❌ 部署失敗"
    exit 1
fi

echo ""
echo "=================================="
echo "🎉 全部完成！"
echo "=================================="
echo ""
echo "你現在可以:"
echo "  1. 訪問 http://localhost:4321/game/stairs"
echo "  2. 點擊「🧠 強化學習 AI」測試新模型"
echo ""
