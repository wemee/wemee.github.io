import { PhaserBase } from '../../core';
import { BOARD_WIDTH, BOARD_HEIGHT, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import type { AbilityType, Difficulty, UnitType, WarfrontCallbacks } from './types';

/**
 * 《狼煙》遊戲入口。
 * 對外提供 DOM HUD 連動所需的方法與回呼；場內邏輯委派給 GameScene。
 */
export class WarfrontGame extends PhaserBase {
    private callbacks: WarfrontCallbacks;

    constructor(containerId: string, callbacks: WarfrontCallbacks = {}) {
        super(containerId);
        this.callbacks = callbacks;
    }

    start(): void {
        this.initGame({
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            backgroundColor: '#' + COLORS.skyTop.toString(16).padStart(6, '0'),
            pixelArt: false,
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
    startMatch(difficulty: Difficulty): void {
        this.getScene()?.startMatch(difficulty);
    }

    restart(): void {
        this.getScene()?.restart();
    }

    spawnUnit(type: UnitType): void {
        this.getScene()?.spawnPlayerUnit(type);
    }

    upgradeIncome(): void {
        this.getScene()?.upgradePlayerIncome();
    }

    upgradeKeep(): void {
        this.getScene()?.upgradePlayerKeep();
    }

    useAbility(type: AbilityType): void {
        this.getScene()?.useAbility(type);
    }

    cancelAbility(): void {
        this.getScene()?.cancelAbility();
    }

    setSpeed(speed: number): void {
        this.getScene()?.setSpeed(speed);
    }

    togglePause(): void {
        this.getScene()?.togglePause();
    }
}

/** 初始化《狼煙》（供 Astro 頁面使用） */
export function initWarfrontGame(containerId: string, callbacks: WarfrontCallbacks = {}): WarfrontGame {
    const game = new WarfrontGame(containerId, callbacks);
    game.start();
    return game;
}
