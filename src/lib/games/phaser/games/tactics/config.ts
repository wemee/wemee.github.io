/**
 * 戰術地城《推演》全域設定
 * 格盤尺寸、配色、單局常數
 *
 * 玩法核心：完全資訊的預告式戰術解謎。每一層是一個小競技場，
 * 敵人預告下一步行動，玩家靠走位 / 推拉 / 攻擊讓預告落空、誤傷或踩陷阱。
 * 純單局永久死亡，深度無限增長。
 */

/** 競技場格盤（8×6 全可見，無迷霧） */
export const GRID = {
    cols: 8,
    rows: 6,
    tileSize: 64,
} as const;

export const BOARD_WIDTH = GRID.cols * GRID.tileSize; // 512
export const BOARD_HEIGHT = GRID.rows * GRID.tileSize; // 384

/**
 * 配色（對齊站台 Solarized 深色調）
 * 數值為 Phaser 用的 0xRRGGBB
 */
export const COLORS = {
    background: 0x002b36, // body 底色
    floorA: 0x073642, // 地板（棋盤色 A）
    floorB: 0x062f39, // 地板（棋盤色 B）
    wall: 0x004250, // 牆
    gridLine: 0x0e5563,
    text: 0xeee8d5,

    spike: 0xcb4b16, // 尖刺格
    pit: 0x00141a, // 深坑（推入即死）

    player: 0x2aa198, // @ 玩家（cyan）
    telegraph: 0xdc322f, // 敵人預告攻擊格（紅）
    telegraphMove: 0xb58900, // 敵人預告移動目標（黃）
    reachable: 0x268bd2, // 玩家可移動範圍（blue）
    targetable: 0x859900, // 行動可選目標（green）

    // accents（Solarized）
    cyan: 0x2aa198,
    red: 0xdc322f,
    blue: 0x268bd2,
    green: 0x859900,
    yellow: 0xb58900,
    orange: 0xcb4b16,
    magenta: 0xd33682,
} as const;

/** 單局規則常數 */
export const RUN = {
    playerMaxHp: 6,
    playerMoveRange: 3, // 每回合可移動格數（正交）
    spikeDamage: 2, // 踩到尖刺受傷
    collisionDamage: 1, // 被推撞牆/敵人受傷
} as const;

/** localStorage key（最深層數紀錄） */
export const STORAGE_KEY = 'wemee.tactics.bestDepth';
