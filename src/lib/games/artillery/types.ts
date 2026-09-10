/**
 * 《彈道對決》共用型別
 */

import type { GameObservation } from '@/lib/games/core/GameCore';

export type Side = 'player' | 'enemy';

export interface Vec2 {
    x: number;
    y: number;
}

export interface Turret {
    side: Side;
    /** 砲台在地面上的位置 */
    x: number;
    y: number;
    hp: number;
    /** 最近一次使用的仰角（度） */
    angle: number;
    /** 最近一次使用的力道（0-100） */
    power: number;
}

/** 開火指令 */
export interface ShotAction {
    angle: number;
    power: number;
}

/** 單發彈道模擬結果（純運算，不含傷害） */
export interface ShotResult {
    /** 記錄的彈道點，供動畫播放 */
    points: Vec2[];
    /** 落點；飛出場外則為 null */
    impact: Vec2 | null;
    /** 直接命中的砲台 */
    hitTurret: Side | null;
    /** 是否飛出場外 */
    outOfBounds: boolean;
    /** 飛行時間（秒） */
    flightTime: number;
}

/** 砲台被爆炸震退的位移，供上層播放動畫 */
export interface Knockback {
    from: Vec2;
    to: Vec2;
}

/** 一回合開火的完整結果 */
export interface ShotOutcome extends ShotResult {
    shooter: Side;
    angle: number;
    power: number;
    /** 這一發對雙方造成的傷害（含自傷） */
    damage: Record<Side, number>;
    /** 這一發把雙方震退到哪裡（沒被震到的話 from 與 to 相同） */
    knockback: Record<Side, Knockback>;
}

/** 砲台當下的呈現姿態（含中彈動畫的位移與地形傾斜） */
export interface TurretPose {
    x: number;
    y: number;
    /** 車體貼合地形的傾角（弧度） */
    tilt: number;
    /** 腳下地面的 y，用來畫影子與判斷騰空高度 */
    groundY: number;
}

export interface ArtilleryState extends GameObservation {
    width: number;
    height: number;
    seed: number;
    /** 地表高度陣列，整局不變 */
    groundYs: number[];
    turrets: Record<Side, Turret>;
    /** 輪到誰開火 */
    turn: Side;
    /** 回合數，從 1 開始 */
    round: number;
    over: boolean;
    winner: Side | 'draw' | null;
    lastShot: ShotOutcome | null;
}
