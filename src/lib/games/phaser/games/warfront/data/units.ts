/**
 * 兵種定義與相剋關係。
 *
 * 相剋三角（核心三兵）：🛡️盾 剋 ⚔️騎、⚔️騎 剋 🏹弓、🏹弓 剋 🛡️盾。
 * 騎兵同時擅長突進後排，對 🔮法師 / ✨牧師 也有加成。
 * 法師走範圍輸出、牧師走治療輔助，不參與三角，但都脆弱怕突擊。
 */

import { COLORS } from '../config';
import type { UnitType } from '../types';

export type UnitKind = 'melee' | 'ranged' | 'mage' | 'cleric';

export interface UnitDef {
    type: UnitType;
    name: string;
    emoji: string;
    kind: UnitKind;
    cost: number;
    maxHp: number;
    /** 每次攻擊傷害；牧師此值為治療量 */
    atk: number;
    /** 攻擊判定距離（px） */
    range: number;
    /** 移動速度（px/秒） */
    speed: number;
    /** 攻擊間隔（秒） */
    attackCd: number;
    /** 繪製半徑 */
    radius: number;
    color: number;
    /** 法師範圍傷害半徑 */
    aoeRadius?: number;
    /** 牧師治療半徑 */
    healRadius?: number;
    desc: string;
    counterText: string;
}

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
    shield: {
        type: 'shield',
        name: '盾兵',
        emoji: '🛡️',
        kind: 'melee',
        cost: 45,
        maxHp: 280,
        atk: 9,
        range: 26,
        speed: 34,
        attackCd: 1.0,
        radius: 15,
        color: COLORS.blue,
        desc: '高血量低攻擊的前排肉盾',
        counterText: '剋 騎兵',
    },
    archer: {
        type: 'archer',
        name: '弓兵',
        emoji: '🏹',
        kind: 'ranged',
        cost: 55,
        maxHp: 70,
        atk: 16,
        range: 156,
        speed: 40,
        attackCd: 1.1,
        radius: 13,
        color: COLORS.green,
        desc: '遠程點放，怕被近身',
        counterText: '剋 盾兵',
    },
    cavalry: {
        type: 'cavalry',
        name: '騎兵',
        emoji: '⚔️',
        kind: 'melee',
        cost: 72,
        maxHp: 115,
        atk: 27,
        range: 26,
        speed: 96,
        attackCd: 0.7,
        radius: 14,
        color: COLORS.orange,
        desc: '高速高攻，衝進後排秒脆皮',
        counterText: '剋 弓兵 / 法師 / 牧師',
    },
    mage: {
        type: 'mage',
        name: '法師',
        emoji: '🔮',
        kind: 'mage',
        cost: 98,
        maxHp: 66,
        atk: 24,
        range: 168,
        speed: 34,
        attackCd: 1.6,
        radius: 13,
        color: COLORS.violet,
        aoeRadius: 56,
        desc: '範圍傷害，專剋成群近戰',
        counterText: '剋 集群',
    },
    cleric: {
        type: 'cleric',
        name: '牧師',
        emoji: '✨',
        kind: 'cleric',
        cost: 82,
        maxHp: 92,
        atk: 20, // 治療量
        range: 150, // 與敵保持的距離（不主動進攻）
        speed: 38,
        attackCd: 1.3,
        radius: 13,
        color: COLORS.yellow,
        healRadius: 88,
        desc: '持續治療周圍我軍，放大前排續航',
        counterText: '輔助',
    },
};

/** 商店顯示順序 */
export const UNIT_TYPES: UnitType[] = ['shield', 'archer', 'cavalry', 'mage', 'cleric'];

/** 各兵種「剋制」的對象 */
const STRONG_AGAINST: Record<UnitType, UnitType[]> = {
    shield: ['cavalry'],
    cavalry: ['archer', 'mage', 'cleric'],
    archer: ['shield'],
    mage: [],
    cleric: [],
};

export const COUNTER_STRONG = 1.6;
export const COUNTER_WEAK = 0.7;

/**
 * 相剋傷害倍率。
 * - 攻方剋守方 → 1.6 倍
 * - 攻方被守方剋（守方剋攻方）→ 0.7 倍
 * - 其餘 → 1.0 倍
 */
export function counterMultiplier(attacker: UnitType, defender: UnitType): number {
    if (STRONG_AGAINST[attacker].includes(defender)) return COUNTER_STRONG;
    if (STRONG_AGAINST[defender].includes(attacker)) return COUNTER_WEAK;
    return 1;
}
