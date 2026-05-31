/**
 * 戰術地城《推演》共用型別
 */

export interface GridPos {
    col: number;
    row: number;
}

/** 地形：地板可走、牆阻擋、尖刺受傷、深坑即死、樓梯（清場後啟用） */
export type TileType = 'floor' | 'wall' | 'spike' | 'pit';

export type EnemyKind = 'charger' | 'archer' | 'brute';

export type GameStatus = 'playing' | 'cleared' | 'dead';

/** 敵人的「預告」——鎖定的下一步行動，玩家可據此推演 */
export interface Intent {
    /** 預告移動目標格（null = 原地不動） */
    moveTo: GridPos | null;
    /** 預告攻擊格（解算時對其上任何單位造成傷害，含友傷） */
    attackTiles: GridPos[];
    /** 攻擊傷害（= 敵人 damage，快取於此供 HUD/渲染參考） */
    damage: number;
}

export interface EnemyState {
    id: number;
    kind: EnemyKind;
    pos: GridPos;
    hp: number;
    maxHp: number;
    damage: number;
    moveRange: number;
    intent: Intent;
    /** 本回合被玩家推/拉位移 → 行動中斷，預告作廢 */
    disrupted: boolean;
}

export interface PlayerState {
    pos: GridPos;
    hp: number;
    maxHp: number;
}

/** 玩家行動（基礎攻擊 + 蒐集到的技能） */
export type ActionId = 'strike' | 'shove' | 'spear' | 'hook' | 'whirl' | 'bolt' | 'repair';

export interface ActionDef {
    id: ActionId;
    name: string;
    desc: string;
    /** 目標型態：adjacent=相鄰單體、line=直線、self=自身、ranged=範圍內任一格 */
    targeting: 'adjacent' | 'line' | 'self' | 'ranged' | 'all-adjacent';
    range: number;
    damage: number;
    push: number; // 推開格數（正=推離、負=拉近）
    healing: number;
}

/** 對外（DOM HUD）使用的狀態快照 */
export interface TacticsSnapshot {
    hp: number;
    maxHp: number;
    depth: number; // 目前層（1-based）
    enemiesLeft: number;
    status: GameStatus;
    actions: ActionDef[];
    bestDepth: number;
    moveUsed: boolean;
    actionUsed: boolean;
}

/** 層間二選一獎勵 */
export interface RewardChoice {
    options: ActionDef[];
}

/** TacticsGame 對外回呼（連動 DOM HUD） */
export interface TacticsCallbacks {
    onStateChange?: (state: TacticsSnapshot) => void;
    /** 清場後提供層間二選一獎勵；玩家選定後呼叫 game.chooseReward(id) */
    onRewardOffer?: (choice: RewardChoice) => void;
    /** 一段訊息（如「友傷！」「推入深坑」），給 HUD 飄字用 */
    onLog?: (msg: string) => void;
}
