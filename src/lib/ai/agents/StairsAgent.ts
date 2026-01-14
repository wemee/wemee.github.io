/**
 * Stairs Game AI Agent
 *
 * 使用訓練好的 TF.js 模型來玩樓梯遊戲
 */

import { TFJSAgent, type TFJSAgentConfig } from '../core/TFJSAgent';
import type { PredictionResult } from '../core/Agent';
import type { StairsGameState, Action } from '@/lib/games/StairsGameCore';

/**
 * Stairs 專用配置
 */
export interface StairsAgentConfig extends Partial<TFJSAgentConfig> {
  /** 模型路徑，預設從 /models/stairs/ 載入 */
  modelPath?: string;
}

/**
 * Stairs Game AI Agent
 */
export class StairsAgent extends TFJSAgent<StairsGameState, Action> {
  private readonly ACTION_MAP: Action[] = ['left', 'right', 'none'];

  constructor(config: StairsAgentConfig = {}) {
    super({
      modelPath: config.modelPath || '/models/stairs/model.json',
      modelType: 'tfjs',
      deterministic: config.deterministic ?? true,
      useWebGL: config.useWebGL ?? true,
      warmup: config.warmup ?? true,
      cacheKey: 'stairs-ai-model-v1',
      ...config
    });
  }

  /**
   * 建立假輸入（用於預熱模型）
   */
  protected createDummyInput(): any {
    // 54-dim observation: player(4) + stairs(10 * 5)
    const dummyObs = this.tf.zeros([1, 54]);
    return dummyObs;
  }

  /**
   * 將遊戲狀態轉換為 Tensor
   */
  protected observationToTensor(state: StairsGameState): any {
    const obs = new Float32Array(54);

    // Player state (4 dims)
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

    // 建立 tensor [1, 54]
    return this.tf.tensor2d([Array.from(obs)], [1, 54]);
  }

  /**
   * 將模型輸出轉換為動作
   */
  protected async tensorToAction(tensor: any): Promise<PredictionResult<Action>> {
    // 假設模型輸出是 [1, 3] 的 logits 或機率
    const probs = await tensor.data();

    let actionIdx: number;

    if (this.config.deterministic) {
      // Deterministic: 選擇機率最高的動作
      actionIdx = probs.indexOf(Math.max(...Array.from(probs)));
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
