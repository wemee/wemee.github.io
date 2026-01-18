# ML Training Framework

統一的機器學習訓練框架，支援監督式學習和強化學習。

## 🎯 設計原則

### SOLID 原則
- **單一職責**: 遊戲邏輯 (Core) 與渲染 (Game) 分離
- **開閉原則**: 對擴展開放（新遊戲）、對修改封閉（不改核心）
- **里氏替換**: 所有 GameCore 可互換使用
- **介面隔離**: AI Agent 介面最小化
- **依賴反轉**: 依賴抽象類別而非具體實作

## 📁 目錄結構

```
ml-training/
├── shared/                      # 共用框架
│   ├── base_trainer.py          # RL 訓練基類
│   └── exporters/
│       └── tfjs_exporter.py     # TF.js 模型導出
│
├── mnist/                       # 手寫辨識（監督式）
│   ├── train.py                 # 訓練腳本
│   └── export_tfjs.py           # TF.js 導出
│
└── stairs-rl/                   # 樓梯遊戲 RL
    ├── train.py                 # 使用 base_trainer
    ├── stairs_env.py            # Gymnasium 環境
    ├── export_tfjs.py           # 導出前端模型
    └── requirements.txt

src/lib/
├── games/core/                  # 遊戲核心抽象
│   └── GameCore.ts              # 所有遊戲的基類
│
├── games/                       # 各遊戲實作
│   ├── StairsGameCore.ts        # 純邏輯（繼承 GameCore）
│   └── StairsGame.ts            # 渲染層（使用 Core）
│
└── ai/
    ├── core/                    # AI 核心抽象
    │   ├── Agent.ts             # AI 代理基類
    │   └── TFJSAgent.ts         # TF.js 專用基類
    │
    └── agents/                  # 各遊戲 AI
        └── StairsAgent.ts       # Stairs 推理（繼承 TFJSAgent）
```

## 🚀 使用方式

### 訓練新遊戲的 RL Agent

#### 1. 建立遊戲核心（純邏輯）

```typescript
// src/lib/games/MyGameCore.ts
import { GameCore, type GameObservation, type StepResult } from './core/GameCore';

export interface MyGameState extends GameObservation {
  player: { x: number; y: number };
  // ... 其他狀態
}

export class MyGameCore extends GameCore<MyGameState, Action> {
  reset(): MyGameState { /* ... */ }
  step(action: Action): StepResult<MyGameState> { /* ... */ }
  getState(): MyGameState { /* ... */ }
}
```

#### 2. 建立 Python 訓練腳本

```python
# ml-training/mygame-rl/train.py
from shared.base_trainer import BaseRLTrainer
from stable_baselines3 import PPO

class MyGameTrainer(BaseRLTrainer):
    def create_model(self, env):
        return PPO('MlpPolicy', env, verbose=1)

    def export_tfjs(self, model_path, tfjs_path):
        from shared.exporters.tfjs_exporter import export_for_tfjs
        export_for_tfjs(str(model_path), str(tfjs_path))

# 執行
trainer = MyGameTrainer('MyGame-v0', Path('output'))
trainer.train(total_timesteps=100_000)
trainer.export(Path('../../public/models/'))
```

#### 3. 建立前端 AI Agent

```typescript
// src/lib/ai/agents/MyGameAgent.ts
import { TFJSAgent } from '../core/TFJSAgent';
import type { MyGameState, Action } from '@/lib/games/MyGameCore';

export class MyGameAgent extends TFJSAgent<MyGameState, Action> {
  protected observationToTensor(state: MyGameState): any {
    // 轉換狀態為 Tensor
  }

  protected async tensorToAction(tensor: any): Promise<PredictionResult<Action>> {
    // 將模型輸出轉為動作
  }
}
```

#### 4. 在頁面中使用

```typescript
import { MyGameAgent } from '@/lib/ai/agents/MyGameAgent';

const agent = new MyGameAgent({ modelPath: '/models/mygame/model.json' });
await agent.load();

// 遊戲循環中
const { action } = await agent.predict(gameCore.getState());
gameCore.step(action);
```

## 📦 依賴安裝

### Python (訓練) - 統一虛擬環境

**Important**: 所有 RL 訓練模組 (snake-rl, stairs-rl 等) 共用同一個虛擬環境，位於 `ml-training/venv/`。

```bash
# 首次設置
cd ml-training
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 之後每次使用
cd ml-training
source venv/bin/activate

# 訓練 Snake AI
cd snake-rl && python train.py

# 訓練 Stairs AI  
cd stairs-rl && python train.py
```

### JavaScript (前端)
```bash
# TF.js 已透過 CDN 載入，無需額外安裝
```

## 🔧 專業調整

### 1. 數值一致性
- 使用 PyMiniRacer 執行相同的 JS 程式碼
- 確保 V8 引擎計算結果與瀏覽器完全一致

### 2. 模型快取
- LocalStorage 快取已載入的模型
- 7 天有效期，自動更新

### 3. 記憶體管理
- Tensor 使用後立即 dispose()
- Agent 提供 destroy() 方法清理資源

### 4. 效能優化
- WebGL 後端加速（可選）
- 模型預熱（warmup）避免首次推理慢

### 5. 錯誤處理
- 明確的錯誤訊息
- Graceful degradation

## 📝 擴展指南

### 新增遊戲
1. 繼承 `GameCore` 實作純邏輯
2. 建立渲染層使用 Core
3. 建立 Python Gymnasium 環境
4. 繼承 `BaseRLTrainer` 實作訓練
5. 繼承 `TFJSAgent` 實作前端推理

### 新增 AI 類型
1. 繼承 `Agent` 基類
2. 實作 `load()` 和 `predict()`
3. 如果是演算法 AI，繼承 `AlgorithmAgent`

## 🎓 參考資料

- [Gymnasium](https://gymnasium.farama.org/) - RL 環境標準
- [Stable Baselines3](https://stable-baselines3.readthedocs.io/) - RL 演算法庫
- [TensorFlow.js](https://www.tensorflow.org/js) - 瀏覽器端 ML
- [PyMiniRacer](https://github.com/bpcreech/PyMiniRacer) - Python 執行 JS

## Sources:
- [Reviving PyMiniRacer](https://simonwillison.net/2024/Mar/24/reviving-pyminiracer/)
- [PyMiniRacer Documentation](https://bpcreech.com/PyMiniRacer/)
- [GitHub - bpcreech/PyMiniRacer](https://github.com/bpcreech/PyMiniRacer)
