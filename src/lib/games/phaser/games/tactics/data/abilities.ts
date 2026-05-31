/**
 * 玩家行動定義：基礎攻擊 + 可蒐集技能
 *
 * 設計取向「傷害與操縱並重」：既有傷害技（spear/bolt），也有位移技（shove/hook），
 * 多數攻擊兼帶推力。每回合僅 1 個行動，技能無冷卻，由「一回合一動」自然平衡。
 */
import type { ActionDef, ActionId } from '../types';

export const ACTIONS: Record<ActionId, ActionDef> = {
    strike: {
        id: 'strike',
        name: '揮擊',
        desc: '攻擊相鄰敵人，造成 1 傷並推開 1 格',
        targeting: 'adjacent',
        range: 1,
        damage: 1,
        push: 1,
        healing: 0,
    },
    shove: {
        id: 'shove',
        name: '推擊',
        desc: '把相鄰敵人推開 2 格（撞牆/坑有奇效），造成 1 傷',
        targeting: 'adjacent',
        range: 1,
        damage: 1,
        push: 2,
        healing: 0,
    },
    spear: {
        id: 'spear',
        name: '長矛',
        desc: '刺穿正前方直線 2 格，造成 2 傷',
        targeting: 'line',
        range: 2,
        damage: 2,
        push: 0,
        healing: 0,
    },
    hook: {
        id: 'hook',
        name: '鉤索',
        desc: '勾住 3 格內的敵人並拉近 2 格，造成 1 傷',
        targeting: 'ranged',
        range: 3,
        damage: 1,
        push: -2,
        healing: 0,
    },
    whirl: {
        id: 'whirl',
        name: '橫掃',
        desc: '攻擊四周所有相鄰敵人，各造成 1 傷並推開 1 格',
        targeting: 'all-adjacent',
        range: 1,
        damage: 1,
        push: 1,
        healing: 0,
    },
    bolt: {
        id: 'bolt',
        name: '投矛',
        desc: '對 3 格內任一敵人投擲，造成 2 傷（不推）',
        targeting: 'ranged',
        range: 3,
        damage: 2,
        push: 0,
        healing: 0,
    },
    repair: {
        id: 'repair',
        name: '療傷',
        desc: '原地恢復 2 點生命（消耗本回合行動）',
        targeting: 'self',
        range: 0,
        damage: 0,
        push: 0,
        healing: 2,
    },
};

/** 起始行動 */
export const STARTING_ACTIONS: ActionId[] = ['strike', 'shove'];

/** 層間獎勵池（起始已有的不再提供） */
export const REWARD_POOL: ActionId[] = ['spear', 'hook', 'whirl', 'bolt', 'repair'];
