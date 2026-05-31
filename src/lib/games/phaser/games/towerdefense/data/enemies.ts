/**
 * 敵人種類定義（資料驅動）
 */

import { COLORS } from '../config';
import type { EnemyType } from '../types';

export interface EnemyDef {
    type: EnemyType;
    name: string;
    maxHp: number;
    speed: number; // 沿路徑前進速度（px / 秒）
    reward: number; // 擊殺獲得金幣
    leakDamage: number; // 漏怪扣除生命
    color: number;
    radius: number;
    /** 死亡時分裂出的子敵（splitter 用） */
    splitInto?: { type: EnemyType; count: number };
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
    normal: {
        type: 'normal',
        name: '普通兵',
        maxHp: 60,
        speed: 55,
        reward: 6,
        leakDamage: 1,
        color: COLORS.orange,
        radius: 12,
    },
    fast: {
        type: 'fast',
        name: '快速兵',
        maxHp: 35,
        speed: 110,
        reward: 7,
        leakDamage: 1,
        color: COLORS.yellow,
        radius: 9,
    },
    heavy: {
        type: 'heavy',
        name: '重甲兵',
        maxHp: 240,
        speed: 34,
        reward: 16,
        leakDamage: 2,
        color: COLORS.magenta,
        radius: 16,
    },
    splitter: {
        type: 'splitter',
        name: '分裂兵',
        maxHp: 90,
        speed: 50,
        reward: 10,
        leakDamage: 1,
        color: COLORS.green,
        radius: 13,
        splitInto: { type: 'fast', count: 2 },
    },
};
