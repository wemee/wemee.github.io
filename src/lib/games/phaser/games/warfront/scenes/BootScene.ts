import Phaser from 'phaser';

/**
 * BootScene：全程以 Graphics/Text 繪製，無外部資源需預載，直接進入主場景。
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create(): void {
        this.scene.start('GameScene');
    }
}
