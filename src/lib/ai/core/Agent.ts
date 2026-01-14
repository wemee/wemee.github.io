/**
 * AI 代理抽象類
 *
 * 統一不同框架的 AI 推理介面：
 * - TensorFlow.js
 * - ONNX Runtime Web
 * - 自定義演算法
 */

import type { GameObservation } from '@/lib/games/core/GameCore';

/**
 * 模型類型
 */
export type ModelType = 'tfjs' | 'onnx' | 'algorithm';

/**
 * AI 代理配置
 */
export interface AgentConfig {
  /** 模型路徑或 URL */
  modelPath?: string;
  /** 模型類型 */
  modelType: ModelType;
  /** 是否使用 deterministic 策略 */
  deterministic?: boolean;
  /** 快取鍵（用於 LocalStorage） */
  cacheKey?: string;
  /** 額外配置 */
  [key: string]: any;
}

/**
 * 預測結果
 */
export interface PredictionResult<TAction = any> {
  /** 選擇的動作 */
  action: TAction;
  /** 信心度或機率（可選） */
  confidence?: number;
  /** 額外資訊（如所有動作機率） */
  info?: Record<string, any>;
}

/**
 * AI 代理抽象類
 */
export abstract class Agent<
  TObservation extends GameObservation = GameObservation,
  TAction = any
> {
  protected config: AgentConfig;
  protected model: any = null;
  protected isLoaded: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 載入模型
   * @throws 載入失敗時拋出錯誤
   */
  abstract load(): Promise<void>;

  /**
   * 執行推理，返回動作
   * @param observation 遊戲觀察
   * @returns 預測結果
   * @throws 模型未載入或推理失敗時拋出錯誤
   */
  abstract predict(observation: TObservation): Promise<PredictionResult<TAction>>;

  /**
   * 檢查模型是否已載入
   */
  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * 清理資源（釋放記憶體）
   */
  abstract destroy(): void;

  /**
   * 從快取載入模型（可選）
   */
  protected async loadFromCache(): Promise<boolean> {
    if (!this.config.cacheKey || typeof localStorage === 'undefined') {
      return false;
    }

    try {
      const cached = localStorage.getItem(this.config.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        // 檢查版本或有效期
        if (data.version && data.expiry && Date.now() < data.expiry) {
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load from cache:', error);
    }

    return false;
  }

  /**
   * 儲存模型到快取（可選）
   */
  protected async saveToCache(data: any): Promise<void> {
    if (!this.config.cacheKey || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const cacheData = {
        version: '1.0',
        expiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        data: data
      };
      localStorage.setItem(this.config.cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }
}

/**
 * 演算法代理（不需模型）
 * 用於手寫 AI 邏輯（如 MCTS、啟發式）
 */
export abstract class AlgorithmAgent<
  TObservation extends GameObservation = GameObservation,
  TAction = any
> extends Agent<TObservation, TAction> {
  constructor(config: Omit<AgentConfig, 'modelPath' | 'modelType'> = {}) {
    super({ ...config, modelType: 'algorithm' });
    this.isLoaded = true; // 演算法代理不需載入
  }

  async load(): Promise<void> {
    // 演算法代理不需載入模型
    this.isLoaded = true;
  }

  destroy(): void {
    // 演算法代理通常不需清理
  }
}
