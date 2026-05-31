/**
 * 關卡一波次定義（資料驅動）
 * 每波由數個 group 依序 spawn；group 內每 intervalMs 生成一隻。
 */

import type { EnemyType } from '../types';

export interface SpawnGroup {
    type: EnemyType;
    count: number;
    intervalMs: number;
    /** 此 group 開始前的額外延遲 */
    startDelayMs?: number;
}

export interface WaveDef {
    groups: SpawnGroup[];
}

export const WAVES: WaveDef[] = [
    { groups: [{ type: 'normal', count: 8, intervalMs: 800 }] },
    { groups: [{ type: 'normal', count: 12, intervalMs: 700 }] },
    {
        groups: [
            { type: 'normal', count: 8, intervalMs: 700 },
            { type: 'fast', count: 6, intervalMs: 500, startDelayMs: 1000 },
        ],
    },
    { groups: [{ type: 'heavy', count: 6, intervalMs: 1400 }] },
    { groups: [{ type: 'fast', count: 18, intervalMs: 350 }] },
    {
        groups: [
            { type: 'normal', count: 12, intervalMs: 500 },
            { type: 'heavy', count: 4, intervalMs: 1500, startDelayMs: 1500 },
        ],
    },
    {
        groups: [
            { type: 'splitter', count: 6, intervalMs: 1000 },
            { type: 'fast', count: 10, intervalMs: 400, startDelayMs: 2000 },
        ],
    },
    {
        groups: [
            { type: 'heavy', count: 8, intervalMs: 1100 },
            { type: 'normal', count: 16, intervalMs: 350, startDelayMs: 1000 },
        ],
    },
    {
        groups: [
            { type: 'splitter', count: 10, intervalMs: 700 },
            { type: 'fast', count: 16, intervalMs: 300, startDelayMs: 2500 },
        ],
    },
    {
        groups: [
            { type: 'heavy', count: 12, intervalMs: 800 },
            { type: 'splitter', count: 8, intervalMs: 700, startDelayMs: 2000 },
            { type: 'fast', count: 24, intervalMs: 250, startDelayMs: 4000 },
        ],
    },
];

export const TOTAL_WAVES = WAVES.length;
