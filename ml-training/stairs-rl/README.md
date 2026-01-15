# Stairs Game RL Training

下樓梯遊戲的強化學習訓練環境與部署工具。

## 系統架構（重構版）

```
前端（瀏覽器）                    後端（Python）
     │                               │
     ▼                               ▼
┌─────────────┐              ┌─────────────┐
│ StairsGame  │              │ stairs_env  │
│  (渲染層)   │              │ (Gymnasium) │
└──────┬──────┘              └──────┬──────┘
       │                            │
       ▼                            ▼
┌──────────────────────────────────────────┐
│           StairsGameCore.ts              │
│         （純遊戲邏輯，無 DOM）            │
│              ↓ 依賴注入                  │
│         ScoringStrategy                  │
└──────────────────────────────────────────┘
       │                            │
       ▼                            ▼
┌─────────────┐              ┌─────────────┐
│ Frontend    │              │ Training    │
│ Scoring     │              │ Scoring     │
│ Strategy    │              │ Strategy    │
└─────────────┘              └─────────────┘
```

### 職責分離（SOLID 原則）

| 組件 | 職責 | 檔案位置 |
|------|------|----------|
| **StairsGameCore** | 物理邏輯、碰撞檢測、遊戲狀態 | `src/lib/games/StairsGameCore.ts` |
| **ScoringStrategy** | 計分規則（前後端分離） | `src/lib/games/core/ScoringStrategy.ts` |
| **StairsGame** | 瀏覽器渲染、用戶輸入 | `src/lib/games/StairsGame.ts` |
| **stairs_env** | Gymnasium 環境包裝 | `ml-training/stairs-rl/stairs_env.py` |

## 計分策略系統

### FrontendScoringStrategy（前端顯示用）

給玩家看的分數，整數顯示：

```typescript
onStep(stepCount): 每5步 +1 分
onStairLanded():   踩樓梯 +1 分
onWallHit():       0（不懲罰）
onDeath():         0（不懲罰）
```

### TrainingScoringStrategy（RL 訓練用）

用於強化學習訓練，稀疏獎勵：

```typescript
onStep(stepCount): 0（不計時間）
onStairLanded():   踩樓梯 +1 分（唯一正獎勵）
onWallHit():       -0.5 分（懲罰撞牆）
onDeath():         0（不懲罰死亡）
```

### 如何修改計分規則

**開放封閉原則**：創建新策略，不修改現有代碼

1. 在 `ScoringStrategy.ts` 中創建新類別：
```typescript
export class MyCustomScoringStrategy implements ScoringStrategy {
    onStep(stepCount: number): number { return 0; }
    onStairLanded(): number { return 1; }
    onWallHit(): number { return -1; }  // 更重的懲罰
    onDeath(): number { return -10; }   // 懲罰死亡
    reset(): void {}
}
```

2. 在 `stairs_env.py` 中使用新策略：
```python
self.ctx.eval("""
const strategy = new MyCustomScoringStrategy();
const game = new StairsGameCoreClass({
    scoringStrategy: strategy
});
""")
```

3. 重新編譯：`npm run build:rl-core`

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

#### 1. 環境設置（只需一次）

```bash
cd ml-training/stairs-rl
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. 編譯遊戲核心

從專案根目錄執行：
```bash
npm run build:rl-core
```

#### 3. 訓練模型

```bash
cd ml-training/stairs-rl
source venv/bin/activate

# 快速驗證（5K 步，約 5-10 秒）
python train.py --timesteps 5000

# 標準訓練（50K 步，約 1 分鐘）
python train.py --timesteps 50000 --n-envs 4 --eval-freq 2000
```

#### 4. 部署到前端

```bash
python deploy.py
```

這會：
1. 導出模型權重為 JSON
2. 複製到 `public/models/stairs/model_weights.json`
3. 自動 git commit

#### 5. 測試前端

```bash
# 從專案根目錄
npm run dev
# 訪問 http://localhost:4321/game/stairs
# 點擊「🧠 強化學習 AI」按鈕
```

## 目錄結構

```
ml-training/stairs-rl/
├── dist/
│   └── StairsGameCore.js    # 編譯後的遊戲核心（含 ScoringStrategy）
├── output/
│   ├── logs/                # TensorBoard 日誌
│   └── models/              # 訓練的模型（.zip）
├── stairs_env.py            # Gymnasium 環境（注入 TrainingScoringStrategy）
├── train.py                 # 訓練腳本
├── deploy.py                # 部署腳本
├── train_and_deploy.sh      # 一鍵腳本
├── export_weights_json.py   # 手動導出權重
├── EXPERIMENTS.md           # 實驗記錄
└── requirements.txt         # Python 依賴

src/lib/games/
├── core/
│   ├── GameCore.ts          # 抽象基類
│   └── ScoringStrategy.ts   # ⭐ 計分策略介面和實現
├── StairsGameCore.ts        # 遊戲核心邏輯（依賴注入 ScoringStrategy）
└── StairsGame.ts            # 瀏覽器渲染層（含 destroy() 方法）

src/lib/ai/agents/
└── StairsWeightsAgent.ts    # 前端 AI Agent
```

## 技術架構

### 工作原理

1. **PyMiniRacer** 在 Python 中運行 V8 JavaScript 引擎
2. 遊戲邏輯在 V8 中執行（與瀏覽器完全一致）
3. `TrainingScoringStrategy` 通過依賴注入控制訓練時的計分
4. Python RL 算法通過 `reset()` / `step()` 介面互動
5. 訓練完成後導出為 JSON 權重供瀏覽器使用

### 觀察空間（54 維）

```
[0-3]:   玩家狀態 (x, y, vx, vy) - 正規化到 0~1
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

## 訓練策略建議

### 當前獎勵設計（稀疏獎勵 + 撞牆懲罰）

```
踩樓梯: +1 分（唯一正獎勵來源）
撞牆:   -0.5 分（避免一直撞牆的行為）
存活:   0 分
死亡:   0 分
```

**設計理念**：讓 AI 自己發現「存活越久 = 能踩更多樓梯」

### 常見問題和解決方案

| 問題 | 可能原因 | 解決方案 |
|------|----------|----------|
| AI 只往一個方向移動 | deterministic mode | 設置 `deterministic: false` |
| AI 一直撞牆 | 撞牆懲罰太輕 | 增加懲罰（如 -1.0） |
| 學習緩慢 | 稀疏獎勵 | 加入微小存活獎勵（0.001/step） |
| 前端遊戲提前結束 | 多個遊戲循環 | 確保調用 `game.destroy()` |

## 監控訓練

### TensorBoard

```bash
tensorboard --logdir output/logs
# 訪問 http://localhost:6006
```

### 評估輸出範例

```
Episode 1: score=5,  steps=812, reward=5.0
Episode 2: score=3,  steps=515, reward=3.0
...
Average score: 1.9 (±1.8)
```

## 重要注意事項

### 1. 前後端分離

- **前端**（瀏覽器）：自動使用 `FrontendScoringStrategy`（預設）
- **後端**（訓練）：在 `stairs_env.py` 中注入 `TrainingScoringStrategy`
- 兩者計分規則不同，但共用同一個 `StairsGameCore`

### 2. 遊戲循環問題

`StairsGame` 有 `destroy()` 方法來停止遊戲循環。創建新實例前必須先銷毀舊實例：

```typescript
// ⚠️ 必須這樣做
if (game) game.destroy();
game = new StairsGame(rlAgent);
```

### 3. 修改後需要重新編譯

修改以下檔案後，必須執行 `npm run build:rl-core`：
- `StairsGameCore.ts`
- `ScoringStrategy.ts`
- `GameCore.ts`

## 常用命令

```bash
# 編譯遊戲核心（修改 TypeScript 後）
npm run build:rl-core

# 訓練（從 ml-training/stairs-rl 目錄）
source venv/bin/activate
python train.py --timesteps 50000 --n-envs 4

# 部署到前端
python deploy.py

# 查看訓練日誌
tensorboard --logdir output/logs

# 編譯前端（修改 StairsGame.ts 後）
npm run build

# 啟動開發伺服器
npm run dev
```

## 實驗記錄

所有訓練實驗記錄在 `EXPERIMENTS.md`，包括：
- 配置（遊戲參數、獎勵函數、超參數）
- 訓練結果（分數、獎勵、Episode 長度）
- 觀察和問題診斷
- 下一步改進方向

**重要**: 每次訓練後請更新實驗記錄！

## 關鍵優勢

- ✅ **100% 數值一致性** - 訓練與瀏覽器使用相同的 V8 引擎
- ✅ **單一真理來源** - 遊戲邏輯只在 TypeScript 中定義一次
- ✅ **前後端分離** - 計分策略通過依賴注入，互不影響
- ✅ **開放封閉原則** - 新增計分規則不需修改核心代碼
- ✅ **自動化部署** - 一個命令完成訓練和部署

---

最後更新：2026-01-16
架構重構：Strategy Pattern for Scoring
