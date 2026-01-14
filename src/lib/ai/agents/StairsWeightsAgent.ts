/**
 * Stairs Game AI Agent (載入 JSON 權重版本)
 *
 * 這個版本從 JSON 檔案載入權重，手動構建模型
 * 不需要 tensorflowjs_converter 轉換
 */

import { TFJSAgent, type TFJSAgentConfig } from '../core/TFJSAgent';
import type { PredictionResult } from '../core/Agent';
import type { StairsGameState, Action } from '@/lib/games/StairsGameCore';

/**
 * 權重資料格式
 */
interface WeightsData {
  model_info: {
    architecture: string;
    input_dim: number;
    hidden_dim: number;
    output_dim: number;
    activation: string;
  };
  weights: {
    policy_layer1: { kernel: number[][]; bias: number[] };
    policy_layer2: { kernel: number[][]; bias: number[] };
    action_logits: { kernel: number[][]; bias: number[] };
  };
}

/**
 * Stairs Weights Agent 專用配置
 */
export interface StairsWeightsAgentConfig extends Partial<TFJSAgentConfig> {
  /** 權重 JSON 路徑，預設從 /models/stairs/ 載入 */
  weightsPath?: string;
}

/**
 * Stairs Game AI Agent (從 JSON 權重載入)
 */
export class StairsWeightsAgent extends TFJSAgent<StairsGameState, Action> {
  private readonly ACTION_MAP: Action[] = ['left', 'right', 'none'];
  private weightsPath: string;

  constructor(config: StairsWeightsAgentConfig = {}) {
    // 傳遞一個假的 modelPath 給父類（因為我們會覆寫 load()）
    super({
      modelPath: config.weightsPath || '/models/stairs/model_weights.json',
      modelType: 'tfjs',
      deterministic: config.deterministic ?? true,
      useWebGL: config.useWebGL ?? true,
      warmup: config.warmup ?? true,
      cacheKey: 'stairs-rl-weights-v1',
      ...config
    });
    this.weightsPath = config.weightsPath || '/models/stairs/model_weights.json';
  }

  /**
   * 覆寫父類的 load() 方法，從 JSON 權重建立模型
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // 1. 載入 TensorFlow.js
      await this.loadTensorFlowJS();

      // 2. 設定後端
      if ((this.config as TFJSAgentConfig).useWebGL !== false) {
        await this.tf.setBackend('webgl');
      }
      await this.tf.ready();

      // 3. 從 JSON 載入權重
      console.log(`Loading weights from ${this.weightsPath}...`);
      const response = await fetch(this.weightsPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch weights: ${response.statusText}`);
      }
      const weightsData: WeightsData = await response.json();
      console.log('Weights loaded:', weightsData.model_info);

      // 4. 構建模型結構
      this.model = this.buildModel(weightsData);
      console.log('Model built successfully');

      // 5. 預熱模型
      if ((this.config as TFJSAgentConfig).warmup !== false) {
        await this.warmupModel();
      }

      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load model from weights:', error);
      throw new Error(`Model loading failed: ${error}`);
    }
  }

  /**
   * 動態載入 TensorFlow.js（與父類相同邏輯）
   */
  private async loadTensorFlowJS(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).tf) {
      this.tf = (window as any).tf;
      return;
    }

    throw new Error(
      'TensorFlow.js not loaded. Please include ' +
      '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script> ' +
      'in your HTML.'
    );
  }

  /**
   * 從權重資料構建 TF.js 模型
   */
  private buildModel(weightsData: WeightsData): any {
    const { tf } = this;
    const { weights } = weightsData;

    // 構建 Sequential 模型（與訓練時的結構一致）
    const model = tf.sequential({
      layers: [
        // Layer 1: Dense(54 → 64) + Tanh
        tf.layers.dense({
          units: 64,
          activation: 'tanh',
          inputShape: [54],
          name: 'policy_layer1'
        }),
        // Layer 2: Dense(64 → 64) + Tanh
        tf.layers.dense({
          units: 64,
          activation: 'tanh',
          name: 'policy_layer2'
        }),
        // Action layer: Dense(64 → 3) + Softmax
        tf.layers.dense({
          units: 3,
          activation: 'softmax',
          name: 'action_probs'
        })
      ]
    });

    // 載入權重到各層
    model.layers[0].setWeights([
      tf.tensor2d(weights.policy_layer1.kernel),
      tf.tensor1d(weights.policy_layer1.bias)
    ]);
    model.layers[1].setWeights([
      tf.tensor2d(weights.policy_layer2.kernel),
      tf.tensor1d(weights.policy_layer2.bias)
    ]);
    model.layers[2].setWeights([
      tf.tensor2d(weights.action_logits.kernel),
      tf.tensor1d(weights.action_logits.bias)
    ]);

    return model;
  }

  /**
   * 預熱模型（執行一次空推理）
   */
  private async warmupModel(): Promise<void> {
    try {
      const dummyInput = this.createDummyInput();
      if (dummyInput) {
        const output = this.model.predict(dummyInput);
        if (Array.isArray(output)) {
          output.forEach((t: any) => t.dispose());
        } else {
          output.dispose();
        }
        dummyInput.dispose();
      }
      console.log('Model warmup completed');
    } catch (error) {
      console.warn('Model warmup failed:', error);
    }
  }

  /**
   * 建立假輸入（用於預熱模型）
   */
  protected createDummyInput(): any {
    // 54-dim observation: player(4) + stairs(10 * 5)
    return this.tf.zeros([1, 54]);
  }

  /**
   * 將遊戲狀態轉換為 Tensor（與 Python 訓練時的編碼一致）
   */
  protected observationToTensor(state: StairsGameState): any {
    const obs = new Float32Array(54);

    // Player state (4 dims) - 與 stairs_env.py 的 _get_obs() 一致
    obs[0] = state.player.x / 400.0;
    obs[1] = state.player.y / 600.0;
    obs[2] = state.player.vx / 10.0;
    obs[3] = state.player.vy / 20.0;

    // Stairs state (10 stairs * 5 dims each)
    const stairs = state.stairs.slice(0, 10);
    for (let i = 0; i < stairs.length; i++) {
      const stair = stairs[i];
      const base = 4 + i * 5;

      obs[base] = stair.x / 400.0;
      obs[base + 1] = stair.y / 600.0;
      obs[base + 2] = stair.width / 120.0;
      obs[base + 3] = stair.broken ? 1.0 : 0.0;

      // Encode type: normal=0, bounce=1, fragile=2, moving=3
      const typeMap: Record<string, number> = {
        'normal': 0,
        'bounce': 1,
        'fragile': 2,
        'moving': 3
      };
      obs[base + 4] = (typeMap[stair.type] || 0) / 3.0;
    }

    // Pad remaining stairs with zeros if < 10
    for (let i = stairs.length; i < 10; i++) {
      const base = 4 + i * 5;
      obs[base] = 0;
      obs[base + 1] = 0;
      obs[base + 2] = 0;
      obs[base + 3] = 0;
      obs[base + 4] = 0;
    }

    // 建立 tensor [1, 54]
    return this.tf.tensor2d([Array.from(obs)], [1, 54]);
  }

  /**
   * 將模型輸出轉換為動作
   */
  protected async tensorToAction(tensor: any): Promise<PredictionResult<Action>> {
    // 模型輸出是 [1, 3] 的機率分佈（softmax 輸出）
    const probs = await tensor.data();

    let actionIdx: number;

    if (this.config.deterministic) {
      // Deterministic: 選擇機率最高的動作
      actionIdx = this.argMax(Array.from(probs));
    } else {
      // Stochastic: 依機率採樣
      actionIdx = this.sampleAction(probs);
    }

    const action = this.ACTION_MAP[actionIdx];
    const confidence = probs[actionIdx];

    return {
      action,
      confidence,
      info: {
        probabilities: {
          left: probs[0],
          right: probs[1],
          none: probs[2]
        }
      }
    };
  }

  /**
   * 找出最大值的索引
   */
  private argMax(arr: number[]): number {
    let maxIdx = 0;
    let maxVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > maxVal) {
        maxVal = arr[i];
        maxIdx = i;
      }
    }
    return maxIdx;
  }

  /**
   * 依機率採樣動作（用於 stochastic 策略）
   */
  private sampleAction(probs: Float32Array | number[]): number {
    const sum = Array.from(probs).reduce((a, b) => a + b, 0);
    const normalized = Array.from(probs).map(p => p / sum);

    let rand = Math.random();
    for (let i = 0; i < normalized.length; i++) {
      rand -= normalized[i];
      if (rand <= 0) return i;
    }
    return normalized.length - 1;
  }
}
