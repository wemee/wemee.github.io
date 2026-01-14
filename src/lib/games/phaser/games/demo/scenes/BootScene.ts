import Phaser from 'phaser';
import { DEMO_CONFIG } from '../config';

/**
 * Demo 遊戲啟動場景 - 負責載入該遊戲的資源
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload(): void {
        // 顯示載入進度
        this.createLoadingBar();

        // 載入角色 Sprite Sheet
        this.load.spritesheet('player', DEMO_CONFIG.assets.playerSprite, {
            frameWidth: DEMO_CONFIG.player.frameWidth,
            frameHeight: DEMO_CONFIG.player.frameHeight
        });
    }

    create(): void {
        // 建立角色動畫
        this.createAnimations();

        // 切換到遊戲場景
        this.scene.start('GameScene');
    }

    private createLoadingBar(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 載入文字
        const loadingText = this.add.text(width / 2, height / 2 - 30, 'Loading...', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // 進度條背景
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);

        // 進度條
        const progressBar = this.add.graphics();

        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff88, 1);
            progressBar.fillRect(width / 2 - 155, height / 2 + 5, 310 * value, 20);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });
    }

    private createAnimations(): void {
        const { animations } = DEMO_CONFIG.player;

        // Idle 動畫
        this.anims.create({
            key: 'idle',
            frames: this.anims.generateFrameNumbers('player', {
                start: animations.idle.start,
                end: animations.idle.end
            }),
            frameRate: animations.idle.frameRate,
            repeat: -1
        });

        // Walk 動畫
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNumbers('player', {
                start: animations.walk.start,
                end: animations.walk.end
            }),
            frameRate: animations.walk.frameRate,
            repeat: -1
        });

        // Attack 動畫
        this.anims.create({
            key: 'attack',
            frames: this.anims.generateFrameNumbers('player', {
                start: animations.attack.start,
                end: animations.attack.end
            }),
            frameRate: animations.attack.frameRate,
            repeat: 0  // 不重複
        });

        // Hurt 動畫
        this.anims.create({
            key: 'hurt',
            frames: this.anims.generateFrameNumbers('player', {
                start: animations.hurt.start,
                end: animations.hurt.end
            }),
            frameRate: animations.hurt.frameRate,
            repeat: 0
        });
    }
}
