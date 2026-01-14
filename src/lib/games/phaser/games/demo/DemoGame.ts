import { PhaserBase } from '../../core';
import { DEMO_CONFIG } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

/**
 * Demo 遊戲入口
 * 展示 Phaser 3 基本功能
 */
export class DemoGame extends PhaserBase {
    constructor(containerId: string) {
        super(containerId);
    }

    /**
     * 啟動遊戲
     */
    start(): void {
        this.initGame({
            width: DEMO_CONFIG.width,
            height: DEMO_CONFIG.height,
            scene: [BootScene, GameScene]
        });
    }
}

/**
 * 初始化 Demo 遊戲（供 Astro 頁面使用）
 */
export function initDemoGame(containerId: string): DemoGame {
    const game = new DemoGame(containerId);
    game.start();
    return game;
}
