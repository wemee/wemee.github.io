/**
 * 《狼煙》單線拉鋸即時戰略 — 全域設定
 * 盤面尺寸、戰場幾何、配色（對齊站台 Solarized 深色）、經濟/指揮值常數、速度檔位。
 */

/** 盤面尺寸（內部座標；以 Phaser Scale.FIT 等比縮放到容器） */
export const BOARD_WIDTH = 960;
export const BOARD_HEIGHT = 400;

/** 戰場幾何 */
export const GROUND_Y = 308; // 部隊行軍的基準線
export const LANE_JITTER = 24; // 部隊上下散開的幅度，避免完全重疊
export const KEEP_PLAYER_X = 72; // 玩家主堡 x
export const KEEP_ENEMY_X = BOARD_WIDTH - 72; // 敵方主堡 x
// 出兵點在主堡「後方」：所有兵種都從城堡後面出來、往前推進。
// 如此新兵永遠出現在貼城敵軍的後方（自家側），往前走自然接戰，
// 索敵也只需看前方，不會出在敵軍背後而互相無視。
export const SPAWN_BEHIND = 40;
export const MAX_UNITS_PER_SIDE = 64; // 單方部隊數上限（避免失控）

/** 主場優勢：距離自家主堡 HOME_RANGE 內的部隊獲得加成 */
export const HOME_RANGE = 230;
export const HOME_DAMAGE_BONUS = 0.35; // +35% 傷害
export const HOME_DEFENSE_BONUS = 0.25; // 受到傷害 -25%

/** 牧師跟在自家最前線戰鬥單位後方的距離；前方沒有友軍時退回出生點待命 */
export const CLERIC_FOLLOW_GAP = 56;

/** 戰爭迷霧：此 x 之後（敵方後場）平時看不到敵方部隊 */
export const FOG_X = BOARD_WIDTH * 0.6;

/**
 * 配色（Phaser 用 0xRRGGBB；對齊站台 Solarized 深色）
 */
export const COLORS = {
    skyTop: 0x012730,
    skyBottom: 0x033845,
    groundTop: 0x073642,
    groundBottom: 0x04282f,
    hills: 0x05303a,
    gridLine: 0x0e5563,
    text: 0xeee8d5,

    player: 0x268bd2, // 藍方（你）
    playerLight: 0x6fb8e8,
    enemy: 0xdc322f, // 紅方（敵）
    enemyLight: 0xf07a78,

    // accents（Solarized）
    cyan: 0x2aa198,
    green: 0x859900,
    yellow: 0xb58900,
    orange: 0xcb4b16,
    magenta: 0xd33682,
    violet: 0x6c71c4,
    blue: 0x268bd2,
    red: 0xdc322f,

    white: 0xffffff,
    fog: 0x011b22,
} as const;

/** 經濟、主堡、指揮值 */
export const ECONOMY = {
    startGold: 110,
    baseIncome: 9, // 每秒金幣
    incomeStep: 5, // 每級收入增量
    incomeCostBase: 120,
    incomeCostGrowth: 1.45,

    keepHp: 2200,
    keepHpStep: 900,
    keepCostBase: 160,
    keepCostGrowth: 1.55,

    cpStart: 2,
    cpMax: 6,
    cpRegenMs: 2000, // 每 2 秒回 1 點指揮值
} as const;

/** 主堡防禦箭 */
export const KEEP_DEFENSE = {
    range: 150,
    baseDamage: 10,
    damagePerLevel: 6,
    cooldownMs: 850,
} as const;

/** 變速檔位 */
export const SPEEDS = [1, 2, 3] as const;

/** 偵查持續時間（毫秒，遊戲內時間） */
export const SCOUT_DURATION_MS = 6000;
