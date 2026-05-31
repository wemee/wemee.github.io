import Phaser from 'phaser';

/**
 * BootScene：無外部資源需預載（全程以 Graphics 繪製），直接進入主場景。
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create(): void {
        this.scene.start('GameScene');
    }
}
