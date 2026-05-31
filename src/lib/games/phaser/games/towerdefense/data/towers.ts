/**
 * 塔種定義 + 升級階（資料驅動）
 * tiers[0] = 等級 1；cost 為「升到該階」的增量成本。
 */

import { COLORS } from '../config';
import type { TowerType } from '../types';

export interface TowerTier {
    damage: number;
    range: number; // px
    fireRateMs: number; // 兩發間隔
    cost: number; // 升到此階的增量成本（含建造階）
    splash?: number; // 濺射半徑（加農炮）
    slow?: { factor: number; durationMs: number }; // 緩速（緩速塔）
}

export interface TowerDef {
    type: TowerType;
    name: string;
    desc: string;
    color: number; // 塔身主色
    projectileColor: number;
    projectileSpeed: number; // px/s
    tiers: TowerTier[];
}

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
    gun: {
        type: 'gun',
        name: '機槍塔',
        desc: '單體、射速快、便宜',
        color: COLORS.cyan,
        projectileColor: COLORS.cyan,
        projectileSpeed: 460,
        tiers: [
            { damage: 8, range: 110, fireRateMs: 350, cost: 50 },
            { damage: 14, range: 125, fireRateMs: 300, cost: 40 },
            { damage: 22, range: 140, fireRateMs: 250, cost: 70 },
        ],
    },
    cannon: {
        type: 'cannon',
        name: '加農炮',
        desc: '範圍濺射、射速慢、傷害高',
        color: COLORS.red,
        projectileColor: COLORS.orange,
        projectileSpeed: 320,
        tiers: [
            { damage: 26, range: 120, fireRateMs: 1100, splash: 46, cost: 100 },
            { damage: 42, range: 130, fireRateMs: 1000, splash: 56, cost: 80 },
            { damage: 66, range: 145, fireRateMs: 900, splash: 70, cost: 130 },
        ],
    },
    frost: {
        type: 'frost',
        name: '緩速塔',
        desc: '低傷、命中時大幅緩速',
        color: COLORS.blue,
        projectileColor: COLORS.blue,
        projectileSpeed: 380,
        tiers: [
            { damage: 4, range: 100, fireRateMs: 600, slow: { factor: 0.55, durationMs: 1200 }, cost: 70 },
            { damage: 7, range: 110, fireRateMs: 550, slow: { factor: 0.45, durationMs: 1400 }, cost: 60 },
            { damage: 11, range: 125, fireRateMs: 500, slow: { factor: 0.35, durationMs: 1600 }, cost: 90 },
        ],
    },
};

export const TOWER_TYPES: TowerType[] = ['gun', 'cannon', 'frost'];

/** 建造（等級 1）成本 */
export function buildCost(type: TowerType): number {
    return TOWER_DEFS[type].tiers[0].cost;
}

/** 升到 level（1-based）為止的總投入成本 */
export function totalInvested(type: TowerType, level: number): number {
    const tiers = TOWER_DEFS[type].tiers;
    let sum = 0;
    for (let i = 0; i < level && i < tiers.length; i++) sum += tiers[i].cost;
    return sum;
}
