/**
 * StairsGameCore - 純遊戲邏輯核心（重構版）
 *
 * 職責分離：
 * - GameCore: 只負責物理邏輯、碰撞檢測、遊戲狀態
 * - ScoringStrategy: 負責所有計分邏輯
 *
 * 不依賴任何 DOM/Canvas API，可在以下環境運行：
 * - 瀏覽器 (搭配 StairsGame.ts 渲染)
 * - Node.js (headless 測試)
 * - PyMiniRacer (Python RL 訓練)
 *
 * RL 標準介面：reset(), step(), getState()
 */

import { GameCore, type GameObservation, type StepResult, type GameCoreConfig } from './core/GameCore';
import { type ScoringStrategy, FrontendScoringStrategy, TrainingScoringStrategy } from './core/ScoringStrategy';

// === 型別定義 ===

export interface Stair {
    x: number;
    y: number;
    width: number;
    type: 'normal' | 'bounce' | 'fragile' | 'moving';
    broken: boolean;
    moveDir?: number;
    scored?: boolean;  // 是否已計分（踩樓梯計分用）
}

export interface Player {
    x: number;
    y: number;
    radius: number;
    vx: number;
    vy: number;
    onStair: boolean;
}

export interface StairsGameState extends GameObservation {
    player: Player;
    stairs: Stair[];
    score: number;
    scrollSpeed: number;
    gameOver: boolean;
}

export type Action = 'left' | 'right' | 'none';

export interface StairsCoreConfig extends GameCoreConfig {
    canvasWidth?: number;
    canvasHeight?: number;
    gravity?: number;
    moveSpeed?: number;
    stairHeight?: number;
    stairGap?: number;
    initialScrollSpeed?: number;
    maxScrollSpeed?: number;
    scoringStrategy?: ScoringStrategy;  // 注入計分策略
}

// === 簡易隨機數產生器 (可設定種子) ===

class SeededRandom {
    private seed: number;

    constructor(seed?: number) {
        this.seed = seed ?? Date.now();
    }

    setSeed(seed: number): void {
        this.seed = seed;
    }

    // Linear Congruential Generator
    next(): number {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }
}

// === 遊戲核心類別 ===

export class StairsGameCore extends GameCore<StairsGameState, Action> {
    // 畫布尺寸 (邏輯座標，不依賴實際 DOM)
    readonly canvasWidth: number;
    readonly canvasHeight: number;

    // 遊戲常數
    private readonly GRAVITY: number;
    private readonly MOVE_SPEED: number;
    private readonly STAIR_HEIGHT: number;
    private readonly STAIR_GAP: number;
    private readonly INITIAL_SCROLL_SPEED: number;
    private readonly MAX_SCROLL_SPEED: number;

    // 計分策略（依賴注入）
    private readonly scoringStrategy: ScoringStrategy;

    // 遊戲狀態
    private player: Player;
    private stairs: Stair[];
    private score: number;
    private scrollSpeed: number;
    private gameOver: boolean;
    private lastScore: number;
    private stepCount: number;  // 遊戲步數計數

    // 隨機數
    private random: SeededRandom;

    constructor(config: StairsCoreConfig = {}) {
        super(config);
        this.canvasWidth = config.canvasWidth ?? 400;
        this.canvasHeight = config.canvasHeight ?? 600;
        this.GRAVITY = config.gravity ?? 0.3;
        this.MOVE_SPEED = config.moveSpeed ?? 5;
        this.STAIR_HEIGHT = config.stairHeight ?? 12;
        this.STAIR_GAP = config.stairGap ?? 70;
        this.INITIAL_SCROLL_SPEED = config.initialScrollSpeed ?? 2;
        this.MAX_SCROLL_SPEED = config.maxScrollSpeed ?? 6;

        // 依賴注入：計分策略（預設為前端策略）
        this.scoringStrategy = config.scoringStrategy ?? new FrontendScoringStrategy();

        this.random = new SeededRandom();
        this.player = this.createPlayer();
        this.stairs = [];
        this.score = 0;
        this.lastScore = 0;
        this.stepCount = 0;
        this.scrollSpeed = this.INITIAL_SCROLL_SPEED;
        this.gameOver = false;

        this.initStairs();
    }

    // === 公開 API ===

    /**
     * 設定隨機種子 (用於可重現的訓練)
     */
    setSeed(seed: number): void {
        this.random.setSeed(seed);
    }

    /**
     * 重置遊戲狀態
     */
    reset(): StairsGameState {
        this.player = this.createPlayer();
        this.score = 0;
        this.lastScore = 0;
        this.stepCount = 0;
        this.scrollSpeed = this.INITIAL_SCROLL_SPEED;
        this.gameOver = false;
        this.stairs = [];
        this.scoringStrategy.reset();
        this.initStairs();
        return this.getState();
    }

    /**
     * 執行一步遊戲邏輯
     */
    step(action: Action): StepResult<StairsGameState> {
        if (this.gameOver) {
            return {
                observation: this.getState(),
                reward: 0,
                terminated: true,
                truncated: false
            };
        }

        this.lastScore = this.score;
        this.stepCount++;

        // 計分 1: 每步計分（根據策略）
        this.score += this.scoringStrategy.onStep(this.stepCount);

        // 執行動作
        this.applyAction(action);

        // 更新物理（包含踩樓梯計分和撞牆懲罰）
        this.updatePhysics();

        // 更新樓梯
        this.updateStairs();

        // 檢查死亡
        this.checkDeath();

        // 計算獎勵（用於 RL 訓練）
        const reward = this.calculateReward();

        return {
            observation: this.getState(),
            reward: reward,
            terminated: this.gameOver,
            truncated: false
        };
    }

    /**
     * 取得當前遊戲狀態 (用於觀察/渲染)
     */
    getState(): StairsGameState {
        return {
            player: { ...this.player },
            stairs: this.stairs.map(s => ({ ...s })),
            score: this.score,
            scrollSpeed: this.scrollSpeed,
            gameOver: this.gameOver
        };
    }

    /**
     * 取得樓梯高度常數 (給渲染用)
     */
    getStairHeight(): number {
        return this.STAIR_HEIGHT;
    }

    // === 內部方法 ===

    private createPlayer(): Player {
        return {
            x: this.canvasWidth / 2,
            y: 300,
            radius: 15,
            vx: 0,
            vy: 0,
            onStair: false
        };
    }

    private initStairs(): void {
        for (let i = 0; i < 10; i++) {
            this.stairs.push(this.createStair(150 + i * this.STAIR_GAP));
        }
    }

    private createStair(y: number): Stair {
        const types: Stair['type'][] = ['normal', 'normal', 'normal', 'normal', 'bounce', 'fragile', 'moving'];
        const type = this.score > 10
            ? types[Math.floor(this.random.next() * types.length)]
            : 'normal';

        return {
            x: this.random.next() * (this.canvasWidth - 80) + 20,
            y: y,
            width: this.random.next() * 60 + 60,
            type: type,
            broken: false,
            moveDir: type === 'moving' ? (this.random.next() > 0.5 ? 1 : -1) : undefined,
            scored: false
        };
    }

    private applyAction(action: Action): void {
        if (action === 'left') {
            this.player.vx = -this.MOVE_SPEED;
        } else if (action === 'right') {
            this.player.vx = this.MOVE_SPEED;
        } else {
            this.player.vx *= 0.8;
        }
    }

    private updatePhysics(): void {
        // 水平移動（含撞牆檢測）
        const intendedX = this.player.x + this.player.vx;
        const clampedX = Math.max(
            this.player.radius,
            Math.min(intendedX, this.canvasWidth - this.player.radius)
        );

        // 計分 2: 撞牆懲罰（根據策略）
        if (Math.abs(intendedX - clampedX) > 0.01) {
            this.score += this.scoringStrategy.onWallHit();
        }

        this.player.x = clampedX;

        // 重力
        if (!this.player.onStair) {
            this.player.vy += this.GRAVITY;
        }
        this.player.y += this.player.vy;

        // 碰撞檢測
        this.player.onStair = false;
        for (const stair of this.stairs) {
            if (stair.broken) continue;

            const playerBottom = this.player.y + this.player.radius;

            if (this.player.x > stair.x - this.player.radius &&
                this.player.x < stair.x + stair.width + this.player.radius &&
                playerBottom >= stair.y &&
                playerBottom <= stair.y + this.STAIR_HEIGHT + Math.max(this.player.vy, 1)) {

                if (this.player.vy >= 0) {
                    this.player.y = stair.y - this.player.radius;
                    this.player.onStair = true;

                    // 計分 3: 踩樓梯計分（根據策略）
                    if (!stair.scored) {
                        this.score += this.scoringStrategy.onStairLanded();
                        stair.scored = true;
                    }

                    if (stair.type === 'bounce') {
                        this.player.vy = -6;
                        this.player.onStair = false;
                    } else if (stair.type === 'fragile') {
                        stair.broken = true;
                    } else {
                        this.player.vy = 0;
                    }

                    // 跟隨移動樓梯
                    if (stair.type === 'moving' && stair.moveDir) {
                        this.player.x += stair.moveDir * 2;
                    }
                }
            }
        }

        // 玩家跟隨滾動
        this.player.y -= this.scrollSpeed;
    }

    private updateStairs(): void {
        for (const stair of this.stairs) {
            // 向上滾動
            stair.y -= this.scrollSpeed;

            // 移動樓梯左右移動
            if (stair.type === 'moving' && stair.moveDir) {
                stair.x += stair.moveDir * 2;
                if (stair.x <= 10 || stair.x + stair.width >= this.canvasWidth - 10) {
                    stair.moveDir *= -1;
                }
            }

            // 回收並重生樓梯
            if (stair.y + this.STAIR_HEIGHT < 0) {
                Object.assign(stair, this.createStair(this.canvasHeight + 50));
            }
        }

        // 難度遞增
        this.scrollSpeed = this.INITIAL_SCROLL_SPEED + Math.floor(this.score / 10) * 0.5;
        if (this.scrollSpeed > this.MAX_SCROLL_SPEED) {
            this.scrollSpeed = this.MAX_SCROLL_SPEED;
        }
    }

    private checkDeath(): void {
        // 掉出畫面底部或頂部都算死亡
        if (this.player.y > this.canvasHeight + 50 || this.player.y < -20) {
            this.gameOver = true;
        }
    }

    private calculateReward(): number {
        // 計分 4: 死亡懲罰（根據策略）
        if (this.gameOver) {
            return this.scoringStrategy.onDeath();
        }

        // RL 訓練用：獎勵 = 分數變化
        // 這樣可以捕捉所有計分事件（踩樓梯、撞牆等）
        const scoreDelta = this.score - this.lastScore;
        return scoreDelta;
    }
}

// 為了讓 PyMiniRacer 可以直接使用，在全域暴露類別
// 這行只在非模組環境下生效
if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as Record<string, unknown>).StairsGameCore = StairsGameCore;
    (globalThis as unknown as Record<string, unknown>).FrontendScoringStrategy = FrontendScoringStrategy;
    (globalThis as unknown as Record<string, unknown>).TrainingScoringStrategy = TrainingScoringStrategy;
}
