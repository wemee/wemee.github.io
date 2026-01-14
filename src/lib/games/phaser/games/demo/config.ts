/**
 * Demo 遊戲專屬設定
 * 這些設定只適用於 Demo 遊戲
 */

export const DEMO_CONFIG = {
    // 畫面尺寸
    width: 480,
    height: 320,

    // 角色設定
    player: {
        speed: 150,
        frameWidth: 128,   // Sprite 單幀寬度
        frameHeight: 160,  // Sprite 單幀高度
        scale: 0.5,        // 角色縮放比例
        animations: {
            idle: { start: 0, end: 3, frameRate: 6 },
            walk: { start: 4, end: 7, frameRate: 10 },
            attack: { start: 8, end: 11, frameRate: 12 },
            hurt: { start: 12, end: 15, frameRate: 8 }
        }
    },

    // 資源路徑
    assets: {
        playerSprite: '/assets/games/player-sprite.png'
    }
} as const;

export type DemoConfig = typeof DEMO_CONFIG;
