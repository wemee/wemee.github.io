import Phaser from 'phaser';
import { DEMO_CONFIG } from '../config';

/**
 * Demo 遊戲主場景
 */
export class GameScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private attackKey!: Phaser.Input.Keyboard.Key;
    private isAttacking: boolean = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    create(): void {
        // 建立背景（簡單的格子地板）
        this.createBackground();

        // 建立玩家
        this.createPlayer();

        // 設定鍵盤輸入
        this.setupInput();

        // 顯示控制說明
        this.createUI();
    }

    update(): void {
        if (!this.player || this.isAttacking) return;

        const speed = DEMO_CONFIG.player.speed;
        let velocityX = 0;
        let velocityY = 0;
        let isMoving = false;

        // 處理方向輸入
        if (this.cursors.left.isDown) {
            velocityX = -speed;
            this.player.setFlipX(true);
            isMoving = true;
        } else if (this.cursors.right.isDown) {
            velocityX = speed;
            this.player.setFlipX(false);
            isMoving = true;
        }

        if (this.cursors.up.isDown) {
            velocityY = -speed;
            isMoving = true;
        } else if (this.cursors.down.isDown) {
            velocityY = speed;
            isMoving = true;
        }

        // 對角線移動時正規化速度
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707; // 1/√2
            velocityY *= 0.707;
        }

        this.player.setVelocity(velocityX, velocityY);

        // 播放對應動畫
        if (isMoving) {
            this.player.anims.play('walk', true);
        } else {
            this.player.anims.play('idle', true);
        }

        // 處理攻擊
        if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.attack();
        }
    }

    private createBackground(): void {
        const graphics = this.add.graphics();
        const tileSize = 32;
        const colors = [0x4a5568, 0x3d4451];

        for (let y = 0; y < DEMO_CONFIG.height; y += tileSize) {
            for (let x = 0; x < DEMO_CONFIG.width; x += tileSize) {
                const colorIndex = ((x / tileSize) + (y / tileSize)) % 2;
                graphics.fillStyle(colors[colorIndex], 1);
                graphics.fillRect(x, y, tileSize, tileSize);
            }
        }
    }

    private createPlayer(): void {
        // 在畫面中央建立玩家
        this.player = this.physics.add.sprite(
            DEMO_CONFIG.width / 2,
            DEMO_CONFIG.height / 2,
            'player'
        );

        // 設定碰撞邊界
        this.player.setCollideWorldBounds(true);

        // 調整碰撞框大小（比 sprite 小一點）
        this.player.body?.setSize(40, 60);
        this.player.body?.setOffset(44, 90);

        // 縮放到適當大小
        this.player.setScale(DEMO_CONFIG.player.scale);

        // 播放 idle 動畫
        this.player.anims.play('idle');
    }

    private setupInput(): void {
        // 方向鍵
        this.cursors = this.input.keyboard!.createCursorKeys();

        // 攻擊鍵（空白鍵）
        this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    private attack(): void {
        if (this.isAttacking) return;

        this.isAttacking = true;
        this.player.setVelocity(0, 0);
        this.player.anims.play('attack');

        // 播放完攻擊動畫後恢復
        this.player.once('animationcomplete-attack', () => {
            this.isAttacking = false;
        });
    }

    private createUI(): void {
        // 標題
        this.add.text(DEMO_CONFIG.width / 2, 20, '🎮 Phaser 3 Demo', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // 控制說明
        this.add.text(10, DEMO_CONFIG.height - 30, '方向鍵移動 | 空白鍵攻擊', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });
    }
}
