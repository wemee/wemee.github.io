/**
 * Phaser 全站共用預設設定
 * 這些是所有 Phaser 遊戲的基礎設定，各遊戲可覆寫
 */

import Phaser from 'phaser';

/**
 * 預設遊戲設定
 */
export const DEFAULT_GAME_CONFIG: Partial<Phaser.Types.Core.GameConfig> = {
    type: Phaser.AUTO,          // 自動選擇 WebGL 或 Canvas
    pixelArt: true,             // 像素風格（關閉抗鋸齒）
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

/**
 * 合併遊戲設定
 * @param gameConfig 遊戲專屬設定
 * @returns 合併後的完整設定
 */
export function mergeGameConfig(
    gameConfig: Partial<Phaser.Types.Core.GameConfig>
): Phaser.Types.Core.GameConfig {
    return {
        ...DEFAULT_GAME_CONFIG,
        ...gameConfig,
        physics: {
            ...DEFAULT_GAME_CONFIG.physics,
            ...gameConfig.physics
        },
        scale: {
            ...DEFAULT_GAME_CONFIG.scale,
            ...gameConfig.scale
        }
    } as Phaser.Types.Core.GameConfig;
}
