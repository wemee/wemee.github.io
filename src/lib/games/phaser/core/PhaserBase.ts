import Phaser from 'phaser';
import { mergeGameConfig } from './config';

/**
 * Phaser 遊戲基礎類別
 * 所有 Phaser 遊戲都應該繼承或使用這個基礎類別
 */
export class PhaserBase {
    protected game: Phaser.Game | null = null;
    protected containerId: string;

    constructor(containerId: string) {
        this.containerId = containerId;
    }

    /**
     * 初始化並啟動遊戲
     * @param config 遊戲專屬設定
     */
    protected initGame(config: Partial<Phaser.Types.Core.GameConfig>): void {
        const finalConfig = mergeGameConfig({
            parent: this.containerId,
            ...config
        });

        this.game = new Phaser.Game(finalConfig);
    }

    /**
     * 銷毀遊戲實例
     */
    destroy(): void {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
        }
    }

    /**
     * 取得 Phaser 遊戲實例
     */
    getGame(): Phaser.Game | null {
        return this.game;
    }
}
