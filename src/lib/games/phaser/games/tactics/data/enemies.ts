/**
 * 敵種定義（全預告行為）
 *
 * - charger 衝鋒兵：朝玩家移動，停在相鄰時攻擊玩家當前格（預告鎖定）
 * - archer  弓箭手：與玩家同列/同行且無遮蔽時，預告射出整條直線；否則移動一格嘗試對齊
 * - brute   重甲：緩慢逼近（每回合一格），預告對「移動後相鄰四格」橫掃，高傷
 */
import type { EnemyKind } from '../types';

export interface EnemyDef {
    kind: EnemyKind;
    name: string;
    glyph: string; // 場上以字元呈現
    color: number;
    hp: number;
    damage: number;
    moveRange: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
    charger: {
        kind: 'charger',
        name: '衝鋒兵',
        glyph: 'C',
        color: 0xd33682, // magenta
        hp: 3,
        damage: 2,
        moveRange: 2,
    },
    archer: {
        kind: 'archer',
        name: '弓箭手',
        glyph: 'A',
        color: 0xb58900, // yellow
        hp: 2,
        damage: 2,
        moveRange: 1,
    },
    brute: {
        kind: 'brute',
        name: '重甲',
        glyph: 'B',
        color: 0xcb4b16, // orange
        hp: 6,
        damage: 3,
        moveRange: 1,
    },
};

export const ENEMY_KINDS: EnemyKind[] = ['charger', 'archer', 'brute'];
