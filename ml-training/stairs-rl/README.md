# Stairs Game RL Training

下樓梯遊戲的強化學習訓練環境與部署工具。

## 快速開始

### 🚀 一鍵訓練 + 部署

```bash
# 使用預設參數（10K 步）
./train_and_deploy.sh

# 指定訓練步數
./train_and_deploy.sh 50000

# 指定步數和並行環境數
./train_and_deploy.sh 50000 8
```

### 分步執行

#### 1. 訓練模型

```bash
# 快速驗證（5K 步，約 5-10 秒）
python train.py --timesteps 5000

# 標準訓練（10K 步，約 10-20 秒）
python train.py --timesteps 10000

# 長訓練（50K 步，約 1 分鐘）
python train.py --timesteps 50000 --n-envs 8
```

#### 2. 部署到前端

```bash
# 部署最新模型
python deploy.py

# 部署指定模型
python deploy.py --model best_model

# 跳過 Git 提交
python deploy.py --skip-git
```

#### 3. 評估模型

```bash
python train.py --eval
```

## 目錄結構

```
ml-training/stairs-rl/
├── stairs_env.py           # Gymnasium 環境（使用 PyMiniRacer 運行 GameCore）
├── train.py                # 訓練腳本
├── deploy.py               # 部署腳本（導出權重 + 複製到 public/）⭐ NEW
├── train_and_deploy.sh     # 一鍵訓練+部署腳本 ⭐ NEW
├── export_weights_json.py  # 手動導出權重
├── EXPERIMENTS.md          # 實驗記錄 ⭐ NEW
├── requirements.txt        # Python 依賴
├── dist/
│   └── StairsGameCore.js  # 編譯後的遊戲核心（npm run build:rl-core）
└── output/
    ├── models/            # 訓練好的模型（.zip）
    ├── logs/              # TensorBoard 日誌
    └── model_weights.json # 最新導出的權重
```

## 完整工作流程

### 從零開始

```bash
# 1. 安裝 Python 依賴（只需一次）
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 編譯遊戲核心（修改 GameCore 後需重新執行）
cd ../../
npm run build:rl-core
cd ml-training/stairs-rl

# 3. 訓練 + 部署
./train_and_deploy.sh 50000

# 4. 測試
# 訪問 http://localhost:4321/game/stairs
# 點擊「🧠 強化學習 AI」
```

### 快速迭代

```bash
# 修改獎勵函數或觀察空間後
npm run build:rl-core           # 重新編譯
./train_and_deploy.sh 5000      # 快速驗證（5K 步）

# 驗證 OK 後
./train_and_deploy.sh 50000     # 完整訓練
```

## 技術架構

### 工作原理

1. **PyMiniRacer** 在 Python 中運行 V8 JavaScript 引擎
2. 遊戲邏輯在 V8 中執行（與瀏覽器完全一致）
3. Python RL 算法通過 `reset()` / `step()` 介面互動
4. 訓練完成後導出為 TF.js 格式供瀏覽器使用

### 觀察空間（54 維）

```
[0-3]:   玩家狀態 (x, y, vx, vy)
[4-53]:  樓梯狀態 (10 個樓梯 × 5 維)
         每個樓梯: (相對x, 相對y, width, broken, type)

⚠️ 重要: 只包含玩家下方的樓梯（y >= player.y）
```

### 動作空間（3 個離散動作）

```
0 = left   (向左移動)
1 = right  (向右移動)
2 = none   (不移動)
```

### 獎勵函數（當前版本 - Exp #4）

```typescript
死亡: -100 + min(score * 2, 50)  // 存活越久懲罰越小
得分: +100                        // 主要目標
存活: +0.5                        // 每步基礎獎勵
移動: +0.2                        // 鼓勵下落
```

## 實驗記錄

所有訓練實驗記錄在 `EXPERIMENTS.md`，包括：
- 配置（遊戲參數、獎勵函數、超參數）
- 訓練結果（分數、獎勵、Episode 長度）
- 觀察和問題診斷
- 下一步改進方向

**重要**: 每次訓練後請更新實驗記錄！

## 監控訓練

### TensorBoard

```bash
tensorboard --logdir output/logs
# 訪問 http://localhost:6006
```

### 評估輸出範例

```
Episode 1: score=9,  steps=393, reward=1028.8
Episode 2: score=8,  steps=358, reward=907.1
...
Average score: 7.0 (±4.0)
```

## 常見問題

**Q: 如何調整獎勵函數？**

1. 修改 `../../src/lib/games/StairsGameCore.ts` 的 `calculateReward()`
2. 重新編譯: `npm run build:rl-core`
3. 重新訓練: `./train_and_deploy.sh 5000`（先快速驗證）

**Q: 如何回滾到之前的模型？**

```bash
ls output/models/                    # 查看可用模型
python deploy.py --model best_model  # 部署指定模型
```

**Q: 訓練很慢怎麼辦？**

增加並行環境數：
```bash
./train_and_deploy.sh 50000 16  # 16 個並行環境
```

## 關鍵優勢

- ✅ **100% 數值一致性** - 訓練與瀏覽器使用相同的 V8 引擎
- ✅ **單一真理來源** - 遊戲邏輯只在 TypeScript 中定義一次
- ✅ **快速迭代** - 修改規則、重新編譯、重新訓練
- ✅ **自動化部署** - 一個命令完成訓練和部署
