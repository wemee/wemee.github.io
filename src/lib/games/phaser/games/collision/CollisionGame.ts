import { PhaserBase } from '../../core';
import { COLLISION_CONFIG } from './config';
import { CollisionScene } from './scenes/CollisionScene';

/**
 * 碰撞物理測試遊戲入口
 */
export class CollisionGame extends PhaserBase {
    constructor(containerId: string) {
        super(containerId);
    }

    /**
     * 啟動遊戲
     */
    start(): void {
        this.initGame({
            width: COLLISION_CONFIG.width,
            height: COLLISION_CONFIG.height,
            backgroundColor: COLLISION_CONFIG.backgroundColor,
            scene: [CollisionScene]
        });
    }
}

/**
 * 初始化碰撞物理測試（供 Astro 頁面使用）
 */
export function initCollisionGame(containerId: string): CollisionGame {
    const game = new CollisionGame(containerId);
    game.start();
    return game;
}
