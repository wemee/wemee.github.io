import { PhaserBase } from '../../core';
import { BOARD_WIDTH, BOARD_HEIGHT, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import type { TowerDefenseCallbacks, TowerType } from './types';

/**
 * 塔防《防線》遊戲入口。
 * 對外提供 DOM HUD 連動所需的方法與回呼；場內邏輯委派給 GameScene。
 */
export class TowerDefenseGame extends PhaserBase {
    private callbacks: TowerDefenseCallbacks;

    constructor(containerId: string, callbacks: TowerDefenseCallbacks = {}) {
        super(containerId);
        this.callbacks = callbacks;
    }

    start(): void {
        this.initGame({
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            backgroundColor: '#' + COLORS.background.toString(16).padStart(6, '0'),
            scene: [BootScene, GameScene],
            callbacks: {
                postBoot: (game) => {
                    game.registry.set('callbacks', this.callbacks);
                },
            },
        });
    }

    /** 取得 GameScene（可能尚未就緒） */
    private getScene(): GameScene | null {
        const scene = this.game?.scene.getScene('GameScene') as GameScene | undefined;
        return scene ?? null;
    }

    // ── 對外控制 API（DOM HUD → 遊戲）──
    selectTower(type: TowerType | null): void {
        this.getScene()?.selectTowerType(type);
    }

    startWave(): void {
        this.getScene()?.startNextWave();
    }

    setSpeed(speed: number): void {
        this.getScene()?.setSpeed(speed);
    }

    setAutoStart(on: boolean): void {
        this.getScene()?.setAutoStart(on);
    }

    togglePause(): void {
        this.getScene()?.togglePause();
    }

    restart(): void {
        this.getScene()?.restartGame();
    }

    upgradeSelected(): void {
        this.getScene()?.upgradeSelectedTower();
    }

    sellSelected(): void {
        this.getScene()?.sellSelectedTower();
    }
}

/**
 * 初始化塔防遊戲（供 Astro 頁面使用）
 */
export function initTowerDefenseGame(
    containerId: string,
    callbacks: TowerDefenseCallbacks = {},
): TowerDefenseGame {
    const game = new TowerDefenseGame(containerId, callbacks);
    game.start();
    return game;
}
