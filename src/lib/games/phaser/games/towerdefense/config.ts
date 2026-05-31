/**
 * 塔防《防線》全域設定
 * 格盤尺寸、配色、經濟常數、速度檔位
 */

/** 格盤設定 */
export const GRID = {
    cols: 15,
    rows: 9,
    tileSize: 48,
} as const;

export const BOARD_WIDTH = GRID.cols * GRID.tileSize; // 720
export const BOARD_HEIGHT = GRID.rows * GRID.tileSize; // 432

/**
 * 配色（對齊站台 Solarized 深色調）
 * 數值為 Phaser 用的 0xRRGGBB
 */
export const COLORS = {
    background: 0x002b36, // 站台 body 底色
    pathTile: 0x073642, // 路徑格
    buildTile: 0x0a4f5c, // 可建格
    buildTileHover: 0x12707f, // 可建格 hover
    buildTileInvalid: 0x6c2b2b, // 不可放置提示
    gridLine: 0x0e5563, // 格線
    text: 0xeee8d5, // 淺字

    // accents（Solarized）
    cyan: 0x2aa198,
    red: 0xdc322f,
    blue: 0x268bd2,
    green: 0x859900,
    yellow: 0xb58900,
    orange: 0xcb4b16,
    magenta: 0xd33682,
    rangeFill: 0x2aa198,
} as const;

/** 經濟與生命 */
export const ECONOMY = {
    startGold: 150,
    startLives: 20,
    sellRefundRatio: 0.7, // 賣塔退款比例（以已投入總成本計）
} as const;

/** 變速檔位 */
export const SPEEDS = [1, 2, 4, 8] as const;

/** 自動進行下一波的間隔（真實時間，毫秒） */
export const AUTO_NEXT_DELAY_MS = 1200;

/** localStorage key（最佳波次紀錄） */
export const STORAGE_KEY = 'wemee.tower-defense.bestWave';
