/**
 * 關卡成長曲線 — 純函式，方便單獨驗證難度不會失控。
 */

import { AI, STAGE } from './config';

/** 第 n 關的敵方血量 */
export function enemyHpForStage(stage: number): number {
    const level = Math.max(1, Math.floor(stage));
    return Math.floor(STAGE.baseEnemyHp * Math.pow(STAGE.enemyHpGrowth, level - 1));
}

/** 第 n 關的 AI 瞄準誤差。每關略減，但有下限，不會變成神射手 */
export function aiSigmaForStage(stage: number): { angleSigma: number; powerSigma: number } {
    const level = Math.max(1, Math.floor(stage));
    const decay = Math.pow(STAGE.sigmaDecay, level - 1);
    return {
        angleSigma: Math.max(AI.angleSigma * decay, STAGE.minAngleSigma),
        powerSigma: Math.max(AI.powerSigma * decay, STAGE.minPowerSigma),
    };
}
