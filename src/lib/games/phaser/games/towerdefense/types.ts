/**
 * 塔防共用型別
 */

export interface GridPos {
    col: number;
    row: number;
}

export interface Point {
    x: number;
    y: number;
}

export type TowerType = 'gun' | 'cannon' | 'frost';
export type EnemyType = 'normal' | 'fast' | 'heavy' | 'splitter';
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

/** 對外（DOM HUD）使用的遊戲狀態快照 */
export interface GameStateSnapshot {
    gold: number;
    lives: number;
    wave: number; // 目前波次（1-based）；0 = 尚未開始
    totalWaves: number; // 每循環的波數（迴圈長度）
    cycle: number; // 目前循環（0-based）
    waveInProgress: boolean;
    status: GameStatus;
    speed: number;
    bestWave: number;
}

/** 被選取塔的資訊（給升級/賣出面板用） */
export interface SelectedTowerInfo {
    type: TowerType;
    name: string;
    level: number;
    maxLevel: number;
    damage: number;
    range: number;
    upgradeCost: number | null; // null = 已滿級
    sellValue: number;
}

/** TowerDefenseGame 對外回呼（連動 DOM HUD） */
export interface TowerDefenseCallbacks {
    onStateChange?: (state: GameStateSnapshot) => void;
    onTowerSelected?: (info: SelectedTowerInfo | null) => void;
    /** 建築模式的塔種變更（含場內取消時通知 HUD 同步商店高亮） */
    onPlacingChanged?: (type: TowerType | null) => void;
}
