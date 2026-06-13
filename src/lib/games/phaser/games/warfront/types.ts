/**
 * 《狼煙》共用型別
 */

export type Side = 'player' | 'enemy';
export type UnitType = 'shield' | 'archer' | 'cavalry' | 'mage' | 'cleric';
export type AbilityType = 'meteor' | 'rally' | 'scout';
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Point {
    x: number;
    y: number;
}

/** 對外（DOM HUD）使用的遊戲狀態快照 */
export interface GameStateSnapshot {
    gold: number;
    income: number;
    cp: number;
    cpMax: number;

    playerKeepHp: number;
    playerKeepMax: number;
    enemyKeepHp: number;
    enemyKeepMax: number;

    incomeLvl: number;
    incomeCost: number;
    keepLvl: number;
    keepCost: number;

    status: GameStatus;
    difficulty: Difficulty;
    speed: number;
    paused: boolean;
    scouting: boolean;
    /** 戰吼剩餘毫秒（>0 表示加成生效中） */
    rallyMs: number;
}

/** WarfrontGame 對外回呼（連動 DOM HUD） */
export interface WarfrontCallbacks {
    onStateChange?: (state: GameStateSnapshot) => void;
    /** 目前已選取（待瞄準）的技能；null 表示無 */
    onAbilityArmed?: (ability: AbilityType | null) => void;
}
