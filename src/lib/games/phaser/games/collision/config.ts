/**
 * 基礎碰撞遊戲專屬設定
 */

export const COLLISION_CONFIG = {
    // 畫面尺寸
    width: 640,
    height: 480,

    // 球體設定
    balls: {
        count: 18,              // 球的數量
        minRadius: 12,          // 最小半徑
        maxRadius: 25,          // 最大半徑
        minSpeed: 100,          // 最小初始速度
        maxSpeed: 250,          // 最大初始速度
    },

    // 顏色配置（繽紛色彩）
    colors: [
        0xff6b6b,  // 紅
        0xfeca57,  // 橙
        0xffeaa7,  // 黃
        0x55efc4,  // 綠
        0x74b9ff,  // 藍
        0xa29bfe,  // 紫
        0xff85c0,  // 粉
        0x00cec9,  // 青
    ],

    // 背景顏色
    backgroundColor: 0x1a1a2e
} as const;

export type CollisionConfig = typeof COLLISION_CONFIG;
