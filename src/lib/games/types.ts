/**
 * 遊戲共用型別定義
 */

/** 粒子效果 */
export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

/** 遊戲狀態 */
export type GameState = 'start' | 'ready' | 'playing' | 'paused' | 'win' | 'gameover';

/** 按鍵狀態 */
export interface KeyState {
    left: boolean;
    right: boolean;
}
