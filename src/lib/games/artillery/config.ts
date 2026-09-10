/**
 * 《彈道對決》數值設定
 * 所有可調參數集中在此，Core / Renderer / Agent 共用。
 */

/** 邏輯畫布尺寸（與實際像素解耦，靠 DPR 縮放） */
export const FIELD = {
    width: 960,
    height: 540,
} as const;

export const PHYSICS = {
    /** 重力加速度 px/s² */
    gravity: 700,
    /** 力道 0 對應的初速 px/s */
    minSpeed: 120,
    /** 力道 100 對應的初速 px/s */
    maxSpeed: 1050,
    /** 積分步長（秒）。夠小才不會穿過細長山脊 */
    dt: 1 / 240,
    /** 每幾個積分步記錄一個彈道點 */
    recordEvery: 2,
    /** 單發最長飛行時間（秒），超過視為 truncated */
    maxFlightTime: 12,
} as const;

/**
 * 力道上限的保證：
 * - 垂直拋射高度 v²/(2g) = 1050²/1400 ≈ 787 > 畫布高 540 → 再高的山也翻得過
 * - 45° 射程 v²/g = 1050²/700 = 1575 > 畫布寬 960 → 一定打得到對面
 */

export const TURRET = {
    /** 命中判定半徑 */
    radius: 18,
    /** 車體中心距地面高度 */
    centerOffset: 13,
    /** 砲管旋轉軸距地面高度 */
    pivotOffset: 17,
    /** 砲管長度（也是砲彈出膛位置） */
    barrelLength: 30,
    hullWidth: 46,
    hullHeight: 18,
} as const;

export const COMBAT = {
    maxHp: 100,
    /** 直接命中車體傷害 */
    directDamage: 45,
    /** 爆炸中心最大傷害 */
    blastMax: 38,
    /** 爆炸波及半徑，超過此距離無傷害 */
    blastRadius: 110,
} as const;

export const AIM = {
    minAngle: 0,
    maxAngle: 90,
    minPower: 0,
    maxPower: 100,
} as const;

export const TERRAIN = {
    /** 高度取樣點數（midpoint displacement 需 2^k+1） */
    points: 513,
    /** 粗糙度：每次細分的振幅衰減率，越高越崎嶇 */
    roughness: 0.54,
    /** 地表最高處（畫布高度比例，越小越高） */
    minYRatio: 0.34,
    /** 地表最低處 */
    maxYRatio: 0.9,
    /** 砲台平台半寬 */
    padHalfWidth: 36,
    /** 平台邊緣融合寬度，避免出現直角斷崖 */
    padBlend: 48,
    /** 兩門砲台的基準位置（畫布寬比例） */
    playerXRatio: 0.11,
    enemyXRatio: 0.89,
    /** 每局位置隨機抖動幅度 */
    xJitterRatio: 0.035,
} as const;

/** AI 瞄準誤差（固定值、不隨對戰過程改變） */
export const AI = {
    angleSigma: 5,
    powerSigma: 11,
    /** 粗掃描步長 */
    coarseAngleStep: 5,
    coarsePowerStep: 5,
    /** 細掃描範圍與步長 */
    refineSpan: 4,
    refineStep: 1,
} as const;
