/**
 * TensorFlow.js 代理基類
 *
 * 簡化 TF.js 模型載入和推理
 */

import { Agent, type AgentConfig, type PredictionResult } from './Agent';
import type { GameObservation } from '@/lib/games/core/GameCore';

/**
 * TF.js 專用配置
 */
export interface TFJSAgentConfig extends AgentConfig {
  modelType: 'tfjs';
  modelPath: string;
  /** 是否使用 WebGL 後端 */
  useWebGL?: boolean;
  /** 是否預熱模型 */
  warmup?: boolean;
}

/**
 * TF.js 代理基類
 */
export abstract class TFJSAgent<
  TObservation extends GameObservation = GameObservation,
  TAction = any
> extends Agent<TObservation, TAction> {
  protected tf: any; // tensorflow.js 實例
  protected model: any; // tf.LayersModel 或 tf.GraphModel

  constructor(config: TFJSAgentConfig) {
    super(config);
  }

  /**
   * 載入 TF.js 和模型
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // 動態載入 TF.js（如果尚未載入）
      await this.loadTensorFlowJS();

      // 設定後端
      if ((this.config as TFJSAgentConfig).useWebGL !== false) {
        await this.tf.setBackend('webgl');
      }
      await this.tf.ready();

      // 載入模型
      console.log(`Loading model from ${this.config.modelPath}...`);
      this.model = await this.tf.loadLayersModel(this.config.modelPath);
      console.log('Model loaded successfully');

      // 預熱模型（避免首次推理慢）
      if ((this.config as TFJSAgentConfig).warmup !== false) {
        await this.warmupModel();
      }

      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load TF.js model:', error);
      throw new Error(`Model loading failed: ${error}`);
    }
  }

  /**
   * 動態載入 TensorFlow.js
   */
  private async loadTensorFlowJS(): Promise<void> {
    // 如果已經載入，直接使用
    if (typeof window !== 'undefined' && (window as any).tf) {
      this.tf = (window as any).tf;
      return;
    }

    // 動態載入（透過 CDN 或 import）
    throw new Error(
      'TensorFlow.js not loaded. Please include ' +
      '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script> ' +
      'in your HTML.'
    );
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
    } catch (error) {
      console.warn('Model warmup failed:', error);
    }
  }

  /**
   * 建立假輸入（用於預熱）
   * 子類應覆寫此方法
   */
  protected abstract createDummyInput(): any;

  /**
   * 將觀察轉換為 TF.js Tensor
   * 子類必須實作
   */
  protected abstract observationToTensor(observation: TObservation): any;

  /**
   * 將模型輸出轉換為動作
   * 子類必須實作
   */
  protected abstract tensorToAction(tensor: any): Promise<PredictionResult<TAction>>;

  /**
   * 執行推理
   */
  async predict(observation: TObservation): Promise<PredictionResult<TAction>> {
    if (!this.isLoaded) {
      throw new Error('Model not loaded. Call load() first.');
    }

    let inputTensor: any = null;
    let outputTensor: any = null;

    try {
      // 1. 轉換觀察為 Tensor
      inputTensor = this.observationToTensor(observation);

      // 2. 執行推理
      outputTensor = this.model.predict(inputTensor);

      // 3. 轉換輸出為動作
      const result = await this.tensorToAction(outputTensor);

      return result;
    } finally {
      // 4. 清理 Tensor（避免記憶體洩漏）
      if (inputTensor) inputTensor.dispose();
      if (outputTensor) {
        if (Array.isArray(outputTensor)) {
          outputTensor.forEach((t: any) => t.dispose());
        } else {
          outputTensor.dispose();
        }
      }
    }
  }

  /**
   * 清理資源
   */
  destroy(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isLoaded = false;
  }
}
