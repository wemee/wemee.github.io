/**
 * 貪吃蛇遊戲核心邏輯
 * 繼承 GameCore，支援 RL 訓練
 */

import { GameCore, type StepResult, type GameCoreConfig } from './core/GameCore';

// === Types ===

export interface Position {
    x: number;
    y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface SnakeObservation {
    snake: Position[];           // 蛇身座標 (head 在 index 0)
    food: Position;              // 食物座標
    direction: Direction;        // 當前方向
    score: number;               // 分數
    gameOver: boolean;           // 是否結束
    gridWidth: number;           // 網格寬度
    gridHeight: number;          // 網格高度
}

export interface SnakeConfig extends GameCoreConfig {
    gridWidth?: number;          // 網格寬度 (default: 20)
    gridHeight?: number;         // 網格高度 (default: 20)
    initialLength?: number;      // 初始長度 (default: 3)
}

// Action: 0=UP, 1=DOWN, 2=LEFT, 3=RIGHT
export type SnakeAction = 0 | 1 | 2 | 3;

const ACTION_TO_DIRECTION: Record<SnakeAction, Direction> = {
    0: 'UP',
    1: 'DOWN',
    2: 'LEFT',
    3: 'RIGHT',
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT',
};

const DIRECTION_DELTA: Record<Direction, Position> = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
};

// === Game Core ===

export class SnakeGameCore extends GameCore<SnakeObservation, SnakeAction> {
    private gridWidth: number;
    private gridHeight: number;
    private initialLength: number;

    private snake: Position[] = [];
    private food: Position = { x: 0, y: 0 };
    private direction: Direction = 'RIGHT';
    private score: number = 0;
    private gameOver: boolean = false;

    constructor(config: SnakeConfig = {}) {
        super(config);
        this.gridWidth = config.gridWidth ?? 20;
        this.gridHeight = config.gridHeight ?? 20;
        this.initialLength = config.initialLength ?? 3;
        this.reset();
    }

    reset(): SnakeObservation {
        this.currentStep = 0;
        this.score = 0;
        this.gameOver = false;
        this.direction = 'RIGHT';

        // 初始化蛇在中間
        const startX = Math.floor(this.gridWidth / 2);
        const startY = Math.floor(this.gridHeight / 2);
        this.snake = [];
        for (let i = 0; i < this.initialLength; i++) {
            this.snake.push({ x: startX - i, y: startY });
        }

        // 隨機生成食物
        this.spawnFood();

        return this.getState();
    }

    step(action: SnakeAction): StepResult<SnakeObservation> {
        if (this.gameOver) {
            return {
                observation: this.getState(),
                reward: 0,
                terminated: true,
                truncated: false,
            };
        }

        this.currentStep++;

        // 更新方向（不能 180 度轉彎）
        const newDirection = ACTION_TO_DIRECTION[action];
        if (newDirection !== OPPOSITE_DIRECTION[this.direction]) {
            this.direction = newDirection;
        }

        // 計算新頭部位置
        const head = this.snake[0];
        const delta = DIRECTION_DELTA[this.direction];
        const newHead: Position = {
            x: head.x + delta.x,
            y: head.y + delta.y,
        };

        // 檢查碰撞
        if (this.checkCollision(newHead)) {
            this.gameOver = true;
            return {
                observation: this.getState(),
                reward: -10,
                terminated: true,
                truncated: false,
            };
        }

        // 移動蛇
        this.snake.unshift(newHead);

        // 檢查是否吃到食物
        let reward = 0;
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 10;
            reward = 10;
            this.spawnFood();
        } else {
            this.snake.pop(); // 沒吃到食物，移除尾巴
        }

        // 檢查是否超時
        const maxSteps = this.config.maxSteps ?? 1000;
        const truncated = this.currentStep >= maxSteps;

        return {
            observation: this.getState(),
            reward,
            terminated: false,
            truncated,
        };
    }

    getState(): SnakeObservation {
        return {
            snake: [...this.snake],
            food: { ...this.food },
            direction: this.direction,
            score: this.score,
            gameOver: this.gameOver,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
        };
    }

    // === Private Methods ===

    private checkCollision(pos: Position): boolean {
        // 撞牆
        if (pos.x < 0 || pos.x >= this.gridWidth || pos.y < 0 || pos.y >= this.gridHeight) {
            return true;
        }
        // 撞自己（不檢查尾巴，因為尾巴會移走）
        for (let i = 0; i < this.snake.length - 1; i++) {
            if (this.snake[i].x === pos.x && this.snake[i].y === pos.y) {
                return true;
            }
        }
        return false;
    }

    private spawnFood(): void {
        const occupied = new Set(this.snake.map(p => `${p.x},${p.y}`));
        const available: Position[] = [];

        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                if (!occupied.has(`${x},${y}`)) {
                    available.push({ x, y });
                }
            }
        }

        if (available.length > 0) {
            const idx = Math.floor(Math.random() * available.length);
            this.food = available[idx];
        }
    }

    // === Public Helpers ===

    /** 取得當前方向對應的動作 */
    getDirectionAction(): SnakeAction {
        const entries = Object.entries(ACTION_TO_DIRECTION) as [string, Direction][];
        const found = entries.find(([_, dir]) => dir === this.direction);
        return found ? (parseInt(found[0]) as SnakeAction) : 3;
    }

    /** 設定方向（給 UI 用） */
    setDirection(dir: Direction): void {
        if (dir !== OPPOSITE_DIRECTION[this.direction]) {
            this.direction = dir;
        }
    }

    /** 判斷遊戲是否結束 */
    isGameOver(): boolean {
        return this.gameOver;
    }
}
