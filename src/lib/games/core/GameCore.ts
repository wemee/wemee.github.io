/**
 * 遊戲核心抽象類
 *
 * 定義所有遊戲的標準介面，遵循 SOLID 原則：
 * - 分離邏輯與渲染（單一職責）
 * - 對擴展開放，對修改封閉
 * - 可用於 RL 訓練（Python + PyMiniRacer）
 * - 可用於前端推理（Browser + TF.js）
 */

/**
 * 遊戲觀察（狀態）
 * 各遊戲自定義具體結構
 */
export interface GameObservation {
  [key: string]: any;
}

/**
 * 步進結果（符合 Gymnasium 標準）
 */
export interface StepResult<T extends GameObservation = GameObservation> {
  /** 當前觀察 */
  observation: T;
  /** 獎勵值（用於 RL） */
  reward: number;
  /** 是否因遊戲結束而終止 */
  terminated: boolean;
  /** 是否因超時而截斷 */
  truncated: boolean;
  /** 額外資訊 */
  info?: Record<string, any>;
}

/**
 * 遊戲核心配置
 */
export interface GameCoreConfig {
  /** 隨機種子（可重現訓練） */
  seed?: number;
  /** 最大步數 */
  maxSteps?: number;
  /** 自定義配置 */
  [key: string]: any;
}

/**
 * 遊戲核心抽象類
 * 所有遊戲邏輯必須繼承此類
 */
export abstract class GameCore<
  TObservation extends GameObservation = GameObservation,
  TAction = any
> {
  protected config: GameCoreConfig;
  protected currentStep: number = 0;

  constructor(config: GameCoreConfig = {}) {
    this.config = config;
    if (config.seed !== undefined) {
      this.setSeed(config.seed);
    }
  }

  /**
   * 重置遊戲到初始狀態
   * @returns 初始觀察
   */
  abstract reset(): TObservation;

  /**
   * 執行一步遊戲邏輯
   * @param action 動作
   * @returns 步進結果
   */
  abstract step(action: TAction): StepResult<TObservation>;

  /**
   * 取得當前遊戲狀態（用於渲染）
   * @returns 當前觀察
   */
  abstract getState(): TObservation;

  /**
   * 設定隨機種子（可選）
   * @param seed 種子值
   */
  setSeed(seed: number): void {
    // 子類可覆寫實作
  }

  /**
   * 取得當前步數
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * 清理資源（可選）
   */
  destroy(): void {
    // 子類可覆寫實作
  }
}

/**
 * 動作空間類型
 */
export type ActionSpace =
  | { type: 'discrete'; n: number }  // 離散動作（0, 1, 2, ...）
  | { type: 'continuous'; shape: number[]; low?: number[]; high?: number[] };  // 連續動作

/**
 * 觀察空間類型
 */
export type ObservationSpace =
  | { type: 'box'; shape: number[]; low?: number; high?: number }  // 數值向量
  | { type: 'dict'; spaces: Record<string, ObservationSpace> };  // 結構化物件

/**
 * RL 環境介面（可選）
 * 提供訓練所需的空間定義
 */
export interface RLEnvironment {
  actionSpace: ActionSpace;
  observationSpace: ObservationSpace;
}
