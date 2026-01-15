/**
 * ScoringStrategy - 計分策略模式
 *
 * 將計分邏輯從遊戲核心中分離，實現前後端分離
 * 符合 SOLID 原則：
 * - Single Responsibility: 只負責計分
 * - Open/Closed: 新增策略不需修改核心
 * - Liskov Substitution: 所有策略可互換
 * - Dependency Inversion: 依賴抽象而非具體實現
 */

/**
 * 計分策略介面
 */
export interface ScoringStrategy {
    /**
     * 每個遊戲步驟調用
     * @param stepCount 當前總步數
     * @returns 本步得分變化
     */
    onStep(stepCount: number): number;

    /**
     * 踩到新樓梯時調用
     * @returns 得分變化
     */
    onStairLanded(): number;

    /**
     * 撞牆時調用
     * @returns 得分變化（通常為負數或0）
     */
    onWallHit(): number;

    /**
     * 死亡時調用
     * @returns 得分變化（通常為負數或0）
     */
    onDeath(): number;

    /**
     * 重置策略內部狀態（如果有的話）
     */
    reset(): void;
}

/**
 * 前端計分策略（給玩家看）
 *
 * 規則：
 * - 每5步 +1分（整數）
 * - 踩樓梯 +1分
 * - 撞牆不扣分
 * - 死亡不扣分
 */
export class FrontendScoringStrategy implements ScoringStrategy {
    private readonly SURVIVAL_INTERVAL = 5;

    onStep(stepCount: number): number {
        // 每5步給1分
        return stepCount % this.SURVIVAL_INTERVAL === 0 ? 1 : 0;
    }

    onStairLanded(): number {
        return 1;
    }

    onWallHit(): number {
        return 0;  // 不懲罰撞牆
    }

    onDeath(): number {
        return 0;  // 不懲罰死亡
    }

    reset(): void {
        // 無狀態，不需要重置
    }
}

/**
 * 訓練計分策略（RL學習用）
 *
 * 規則：
 * - 不計時間分數
 * - 踩樓梯 +1分（唯一正獎勵）
 * - 撞牆 -0.5分
 * - 死亡不扣分（讓模型自己學會存活的重要性）
 */
export class TrainingScoringStrategy implements ScoringStrategy {
    private readonly WALL_PENALTY = 0.5;

    onStep(stepCount: number): number {
        return 0;  // 不計時間分數
    }

    onStairLanded(): number {
        return 1;  // 唯一的正獎勵來源
    }

    onWallHit(): number {
        return -this.WALL_PENALTY;  // 懲罰撞牆
    }

    onDeath(): number {
        return 0;  // 不懲罰死亡
    }

    reset(): void {
        // 無狀態，不需要重置
    }
}

/**
 * 工廠函數：根據配置創建策略
 */
export function createScoringStrategy(mode: 'frontend' | 'training'): ScoringStrategy {
    switch (mode) {
        case 'frontend':
            return new FrontendScoringStrategy();
        case 'training':
            return new TrainingScoringStrategy();
        default:
            return new FrontendScoringStrategy();
    }
}

// 為了讓 PyMiniRacer 可以直接使用，在全域暴露類別
// 這行只在非模組環境下生效
if (typeof globalThis !== 'undefined') {
    (globalThis as any).FrontendScoringStrategy = FrontendScoringStrategy;
    (globalThis as any).TrainingScoringStrategy = TrainingScoringStrategy;
    (globalThis as any).createScoringStrategy = createScoringStrategy;
}
