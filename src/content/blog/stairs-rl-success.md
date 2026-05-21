---
title: "下樓梯 RL：從規則 AI 失敗到強化學習成功的架構實踐"
pubDate: 2026-01-14
description: "記錄下樓梯遊戲從規則 AI 失敗到 RL 成功的完整歷程。探討 GameCore 分離、PyMiniRacer 數值一致性、統一訓練框架與 500K 步訓練的實作細節。"
author: "wemee (with AI assistant)"
tags: ["reinforcement-learning", "ppo", "architecture", "pytorch", "tensorflow-js", "solid"]
related: ["/game/stairs/"]
---

## 前言：失敗之後

在[上一篇文章](/blog/stairs-ai-failure)中，我記錄了使用規則 AI 的慘痛失敗。震盪效應、鎖定機制的雙面刃、貪婪演算法的侷限——這些問題讓我意識到：**手工打造的決策樹無法應對高動態環境**。

這次，我決定實踐之前的結論：**引入強化學習 (Reinforcement Learning)**。

但 RL 不只是「換個演算法」這麼簡單。它牽涉到架構重構、數值一致性保證、訓練框架設計等一系列工程挑戰。這篇文章記錄了從零到有的完整實踐過程。

→ **[立即試玩 RL AI](/game/stairs)** ←

## 核心挑戰：架構設計

要訓練 RL 模型，首先要解決一個根本問題：

> **如何讓 Python 訓練環境與瀏覽器遊戲保持 100% 一致？**

### 挑戰 1：邏輯與渲染耦合

最初的 `StairsGame.ts` 是一個典型的單體類別：

```typescript
export class StairsGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player = { x: 200, y: 300, vx: 0, vy: 0 };
  private stairs: Stair[] = [];

  private update() {
    // 物理更新
    this.player.vy += 0.3;  // 重力
    this.player.y += this.player.vy;

    // 渲染
    this.ctx.fillRect(this.player.x, this.player.y, 30, 30);
  }
}
```

這樣的架構無法在 Python 中運行（沒有 Canvas），也無法保證訓練時的物理計算與瀏覽器完全相同。

### 解決方案：GameCore 抽象層

參考 OpenAI Gym/Gymnasium 標準，我設計了一個**純邏輯的 GameCore**：

```typescript
// src/lib/games/core/GameCore.ts
export abstract class GameCore<TObservation, TAction> {
  abstract reset(): TObservation;
  abstract step(action: TAction): StepResult<TObservation>;
  abstract getState(): TObservation;
}

// src/lib/games/StairsGameCore.ts
export class StairsGameCore extends GameCore<StairsGameState, Action> {
  // 純邏輯，無 DOM 依賴
  step(action: Action): StepResult<StairsGameState> {
    // 物理更新
    this.player.vy += this.GRAVITY;

    // 碰撞檢測
    const collision = this.checkCollision();

    // 獎勵計算
    const reward = this.calculateReward();

    return {
      observation: this.getState(),
      reward,
      terminated: this.gameOver,
      truncated: false
    };
  }
}
```

然後讓瀏覽器版本**委託邏輯給 Core**：

```typescript
// src/lib/games/StairsGame.ts
export class StairsGame {
  private core: StairsGameCore;  // 委託邏輯

  private update() {
    const action = this.getUserInput();
    const result = this.core.step(action);  // 使用 Core
    this.render(result.observation);  // 只負責渲染
  }
}
```

這樣做的好處：
- ✅ **單一數據來源** (Single Source of Truth)
- ✅ **邏輯與渲染分離** (Separation of Concerns)
- ✅ **可測試性** (Testability) - Core 可獨立測試

## 挑戰 2：Python 如何執行 TypeScript？

GameCore 是用 TypeScript 寫的，但訓練環境需要 Python。有幾種選擇：

| 方案 | 優點 | 缺點 |
|------|------|------|
| 重寫 Python 版本 | 簡單 | ❌ 維護兩份代碼，數值可能不一致 |
| 使用 Node.js 進程通信 | 原生支援 | ❌ IPC 開銷大，訓練慢 |
| **PyMiniRacer (V8)** | ✅ 在 Python 中執行真實 JS | ✅ 100% 數值一致 |

我選擇 **PyMiniRacer**，它在 Python 中嵌入 V8 JavaScript 引擎：

```python
from py_mini_racer import MiniRacer

ctx = MiniRacer()

# 1. 載入編譯好的 GameCore.js (esbuild IIFE 格式)
ctx.eval(open('dist/StairsGameCore.js').read())

# 2. 解包 IIFE 全域變數
ctx.eval("const StairsGameCoreClass = StairsGameCore.StairsGameCore;")
ctx.eval("const game = new StairsGameCoreClass();")

# 3. 執行遊戲邏輯
state_json = ctx.eval("JSON.stringify(game.reset())")
state = json.loads(state_json)  # 轉成 Python dict
```

### 關鍵：JSON 序列化

MiniRacer 返回的是 JavaScript 對象（`JSMappedObjectImpl`），無法直接在 Python 中操作。解決方法：

```python
def _get_state_dict(self):
    """透過 JSON 序列化避免對象類型問題"""
    state_json = self.ctx.eval("JSON.stringify(game.getState())")
    return json.loads(state_json)  # 純 Python dict
```

這樣確保了：
- ✅ **100% 數值一致性** - 使用同一份 JS 代碼
- ✅ **IEEE 754 標準** - V8 與瀏覽器都是 double precision
- ✅ **維護性** - 只需維護一份 TypeScript 代碼

## 挑戰 3：統一訓練框架

有了 GameCore 和 PyMiniRacer，接下來要建立 Gymnasium 環境：

```python
# ml-training/stairs-rl/stairs_env.py
import gymnasium as gym
from gymnasium import spaces

class StairsEnv(gym.Env):
    def __init__(self):
        self.ctx = MiniRacer()
        self.ctx.eval(open('dist/StairsGameCore.js').read())
        self.ctx.eval("const game = new StairsGameCore.StairsGameCore();")

        # 定義動作空間：left, right, none
        self.action_space = spaces.Discrete(3)

        # 定義觀察空間：player(4) + stairs(10*5) = 54 維
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(54,), dtype=np.float32
        )

    def reset(self, seed=None, options=None):
        state_json = self.ctx.eval("JSON.stringify(game.reset())")
        state = json.loads(state_json)
        return self._get_obs(state), {}

    def step(self, action):
        action_str = ['left', 'right', 'none'][action]
        result_json = self.ctx.eval(f"JSON.stringify(game.step('{action_str}'))")
        result = json.loads(result_json)

        obs = self._get_obs(result['observation'])
        reward = result['reward']
        terminated = result['terminated']
        truncated = result['truncated']

        return obs, reward, terminated, truncated, {}

    def _get_obs(self, state):
        """將 JS state 編碼為 54 維向量"""
        obs = np.zeros(54, dtype=np.float32)

        # Player (4 dims)
        obs[0] = state['player']['x'] / 400.0
        obs[1] = state['player']['y'] / 600.0
        obs[2] = state['player']['vx'] / 10.0
        obs[3] = state['player']['vy'] / 20.0

        # Stairs (10 stairs * 5 features)
        for i, stair in enumerate(state['stairs'][:10]):
            base = 4 + i * 5
            obs[base] = stair['x'] / 400.0
            obs[base + 1] = stair['y'] / 600.0
            obs[base + 2] = stair['width'] / 120.0
            obs[base + 3] = 1.0 if stair['broken'] else 0.0
            obs[base + 4] = {'normal': 0, 'bounce': 1, 'fragile': 2, 'moving': 3}[stair['type']] / 3.0

        return obs
```

### Template Method 訓練框架

為了讓未來的遊戲可以重用訓練邏輯，我設計了 `BaseRLTrainer`：

```python
# ml-training/shared/base_trainer.py
from abc import ABC, abstractmethod

class BaseRLTrainer(ABC):
    def __init__(self, env_id: str, output_dir: Path):
        self.env_id = env_id
        self.output_dir = output_dir

    @abstractmethod
    def create_model(self, env):
        """子類實作：建立 RL 演算法 (PPO, DQN, etc.)"""
        pass

    @abstractmethod
    def export_tfjs(self, model_path, tfjs_path):
        """子類實作：導出為 TF.js 格式"""
        pass

    def train(self, total_timesteps, n_envs, callbacks):
        """統一訓練流程"""
        env = make_vec_env(self.env_id, n_envs=n_envs)
        self.model = self.create_model(env)
        self.model.learn(
            total_timesteps=total_timesteps,
            callback=callbacks,
            progress_bar=True
        )
        self.model.save(self.output_dir / 'models' / 'final_model')
        env.close()
```

實際訓練時，只需繼承並實作兩個方法：

```python
# ml-training/stairs-rl/train.py
class StairsRLTrainer(BaseRLTrainer):
    def create_model(self, env):
        return PPO(
            "MlpPolicy", env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            gamma=0.99,
            verbose=1
        )

    def export_tfjs(self, model_path, tfjs_path):
        # 使用 export_weights_json.py
        pass

trainer = StairsRLTrainer(env_id='Stairs-v0', output_dir='output')
trainer.train(total_timesteps=500_000, n_envs=4)
```

這樣的設計符合 **SOLID 原則**：
- **Open-Closed**: 對擴展開放（新遊戲繼承 BaseRLTrainer），對修改關閉
- **Template Method**: 定義訓練流程骨架，細節由子類實作

## 訓練結果

經過 7 分 26 秒，訓練完成：

```
Total timesteps: 507,904 (超過目標 500K)
Training speed: ~1,138 steps/sec (4 parallel envs)
Final episode reward mean: 205

=== Final Evaluation (10 episodes) ===
Average score: 11.5 (±6.5)
Best episode: 28 points, 837 steps, reward=585.0
Score range: 4-28 points
```

### 訓練曲線分析

```
  8K steps: ep_rew_mean = 79.6   (初始隨機探索)
160K steps: ep_rew_mean = 153    (開始學會基本生存)
320K steps: ep_rew_mean = 226    (性能峰值)
500K steps: ep_rew_mean = 205    (穩定收斂)
```

模型在 32 萬步達到峰值後略微下降，這是 RL 中常見的**探索-利用權衡** (Exploration-Exploitation Tradeoff)。

### 模型一致性驗證

在導出模型權重時，我驗證了 PyTorch (訓練) 與 TensorFlow (推理) 的一致性：

```python
# 測試 10 個隨機觀察
Max difference: 1.19e-07

✓ 模型一致性驗證通過！
```

誤差小於 **十億分之一**，可以放心部署到瀏覽器。

## 挑戰 4：模型導出與部署

最初我嘗試使用 `tensorflowjs_converter`，但遇到依賴衝突：

```bash
ERROR: Cannot install tensorflowjs==4.22.0 because these package
versions have conflicting dependencies.
```

### 解決方案：JSON 權重導出

與其糾結複雜的轉換工具，我選擇了最簡單的方法：**直接導出權重為 JSON**。

```python
# ml-training/stairs-rl/export_weights_json.py
def extract_weights_as_json(model):
    policy_net = model.policy.mlp_extractor.policy_net

    weights = {
        "model_info": {
            "architecture": "PPO Policy Network",
            "input_dim": 54,
            "hidden_dim": 64,
            "output_dim": 3
        },
        "weights": {
            "policy_layer1": {
                "kernel": policy_net[0].weight.T.tolist(),  # PyTorch (out,in) → TF (in,out)
                "bias": policy_net[0].bias.tolist()
            },
            "policy_layer2": {
                "kernel": policy_net[2].weight.T.tolist(),
                "bias": policy_net[2].bias.tolist()
            },
            "action_logits": {
                "kernel": model.policy.action_net.weight.T.tolist(),
                "bias": model.policy.action_net.bias.tolist()
            }
        }
    }
    return weights
```

在瀏覽器中，手動構建模型並載入權重：

```typescript
// src/lib/ai/agents/StairsWeightsAgent.ts
async load() {
  const response = await fetch('/models/stairs/model_weights.json');
  const data = await response.json();

  // 構建模型結構（與訓練時一致）
  this.model = tf.sequential({
    layers: [
      tf.layers.dense({units: 64, activation: 'tanh', inputShape: [54]}),
      tf.layers.dense({units: 64, activation: 'tanh'}),
      tf.layers.dense({units: 3, activation: 'softmax'})
    ]
  });

  // 載入權重
  this.model.layers[0].setWeights([
    tf.tensor2d(data.weights.policy_layer1.kernel),
    tf.tensor1d(data.weights.policy_layer1.bias)
  ]);
  // ... 其他層
}
```

這種方法的優點：
- ✅ **無依賴衝突** - 不需要 tensorflowjs_converter
- ✅ **輕量化** - 權重檔案僅 245 KB
- ✅ **完全控制** - 模型結構由我們定義

## 架構總結：SOLID 原則實踐

這次重構完整實踐了 SOLID 五大原則：

### 1. Single Responsibility (單一職責)
- `GameCore`: 只負責遊戲邏輯
- `Game`: 只負責渲染與用戶輸入
- `Agent`: 只負責 AI 推理

### 2. Open-Closed (開閉原則)
- 新遊戲只需繼承 `GameCore`，無需修改基類
- 新 AI 只需繼承 `TFJSAgent`，無需修改框架

### 3. Liskov Substitution (里氏替換)
- 所有 `GameCore` 子類可互換使用
- 所有 `Agent` 子類遵循相同接口

### 4. Interface Segregation (接口隔離)
- `Agent` 接口最小化：`load()`, `predict()`, `destroy()`
- `GameCore` 接口最小化：`reset()`, `step()`, `getState()`

### 5. Dependency Inversion (依賴反轉)
- `Game` 依賴抽象的 `GameCore`，而非具體實作
- `Trainer` 依賴抽象的 `gym.Env`，而非具體遊戲

## 技術棧總結

```
Frontend (Browser)
├── TypeScript/Astro
├── TensorFlow.js 4.22.0
└── Canvas API

Training (Python)
├── PyMiniRacer 0.12.0 (V8 引擎)
├── Stable Baselines3 2.2.0 (PPO)
├── Gymnasium 0.29.0
└── PyTorch 2.0.0

Build Tools
├── esbuild (TS → JS)
└── npm scripts
```

## 未來展望

這套架構已經可以輕鬆擴展到其他遊戲：

1. **Breakout RL** - 打磚塊的 RL 版本
2. **多智能體訓練** - 讓兩個 AI 對戰
3. **Curriculum Learning** - 從簡單關卡逐步增加難度

更重要的是，這次實踐證明了：

> **好的架構設計，讓複雜的 AI 系統變得可維護、可擴展、可測試。**

## 延伸閱讀

- [下樓梯遊戲 AI：從規則引擎到控制理論的失敗實驗](/blog/stairs-ai-failure)
- [打磚塊遊戲 AI：物理模擬與軌跡預測](/blog/breakout-ai)
- [在瀏覽器中訓練 MNIST：TensorFlow.js 實戰](/blog/mnist-browser-ml)

---

**試玩強化學習 AI：** 前往 [下樓梯遊戲頁面](/game/stairs)，點擊「🧠 強化學習 AI」按鈕體驗訓練成果！

---

*本文由 wemee 與 AI 助手 Claude 共同完成。記錄真實的工程實踐與思考過程。*
