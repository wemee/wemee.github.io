import { PhaserBase } from '../../core';
import { BOARD_HEIGHT, BOARD_WIDTH, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import type { ActionId, TacticsCallbacks } from './types';

/**
 * 戰術地城《推演》遊戲入口。
 * 對外提供 DOM HUD 連動所需的方法與回呼；棋局邏輯委派給 GameScene + TacticsCore。
 */
export class TacticsGame extends PhaserBase {
    private callbacks: TacticsCallbacks;

    constructor(containerId: string, callbacks: TacticsCallbacks = {}) {
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

    private getScene(): GameScene | null {
        const scene = this.game?.scene.getScene('GameScene') as GameScene | undefined;
        return scene ?? null;
    }

    // ── 對外控制 API（DOM HUD → 遊戲）──
    /** 選擇行動；回傳是否需要點選棋盤目標 */
    selectAction(id: ActionId): boolean {
        return this.getScene()?.selectAction(id) ?? false;
    }
    cancelAction(): void {
        this.getScene()?.cancelAction();
    }
    endTurn(): void {
        this.getScene()?.endPlayerTurn();
    }
    chooseReward(id: ActionId): void {
        this.getScene()?.chooseReward(id);
    }
    restart(): void {
        this.getScene()?.restartGame();
    }
}

/**
 * 初始化《推演》（供 Astro 頁面使用）
 */
export function initTacticsGame(
    containerId: string,
    callbacks: TacticsCallbacks = {},
): TacticsGame {
    const game = new TacticsGame(containerId, callbacks);
    game.start();
    return game;
}
