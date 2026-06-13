/**
 * 手動指揮技能定義（消耗指揮值 CP）。
 */

import type { AbilityType } from '../types';

export interface AbilityDef {
    type: AbilityType;
    name: string;
    emoji: string;
    cpCost: number;
    /** 是否需要在戰場上點選目標位置 */
    targeted: boolean;
    desc: string;
}

export const ABILITY_DEFS: Record<AbilityType, AbilityDef> = {
    meteor: {
        type: 'meteor',
        name: '隕石',
        emoji: '☄️',
        cpCost: 3,
        targeted: true,
        desc: '點選戰場落點，造成大範圍爆發傷害',
    },
    rally: {
        type: 'rally',
        name: '戰吼',
        emoji: '📣',
        cpCost: 2,
        targeted: false,
        desc: '全軍攻擊與移速大幅提升 5 秒',
    },
    scout: {
        type: 'scout',
        name: '偵查',
        emoji: '🔭',
        cpCost: 1,
        targeted: false,
        desc: '掀開戰爭迷霧，看清敵方後場 6 秒',
    },
};

export const ABILITY_TYPES: AbilityType[] = ['meteor', 'rally', 'scout'];

/** 隕石參數 */
export const METEOR = {
    radius: 78,
    damage: 220,
    telegraphMs: 650, // 落點預警時間（遊戲內時間）
} as const;

/** 戰吼參數 */
export const RALLY = {
    durationMs: 5000,
    damageBonus: 0.5, // +50% 傷害
    speedBonus: 0.4, // +40% 移速
} as const;
