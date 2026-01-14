import Phaser from 'phaser';
import { COLLISION_CONFIG } from '../config';

/**
 * 碰撞物理測試場景
 * 展示完全彈性碰撞（無能量損失）
 */
export class CollisionScene extends Phaser.Scene {
    private balls: Phaser.Physics.Arcade.Sprite[] = [];
    private infoText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'CollisionScene' });
    }

    create(): void {
        // 建立背景
        this.cameras.main.setBackgroundColor(COLLISION_CONFIG.backgroundColor);

        // 建立球體
        this.createBalls();

        // 設定球與球之間的碰撞
        this.physics.add.collider(this.balls, this.balls);

        // 建立 UI
        this.createUI();
    }

    update(): void {
        // 更新資訊文字
        this.updateInfo();
    }

    private createBalls(): void {
        const { balls, colors, width, height } = COLLISION_CONFIG;

        for (let i = 0; i < balls.count; i++) {
            // 隨機半徑
            const radius = Phaser.Math.Between(balls.minRadius, balls.maxRadius);

            // 隨機位置（避免太靠近邊界）
            const x = Phaser.Math.Between(radius + 50, width - radius - 50);
            const y = Phaser.Math.Between(radius + 50, height - radius - 50);

            // 隨機顏色
            const color = colors[i % colors.length];

            // 建立球體（使用 Graphics 繪製圓形）
            const ball = this.createBall(x, y, radius, color);

            // 隨機速度方向
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(balls.minSpeed, balls.maxSpeed);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            ball.setVelocity(vx, vy);

            this.balls.push(ball);
        }
    }

    private createBall(x: number, y: number, radius: number, color: number): Phaser.Physics.Arcade.Sprite {
        // 建立圓形紋理（如果不存在）
        const textureKey = `ball_${radius}_${color.toString(16)}`;

        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ x: 0, y: 0 });

            // 繪製漸層球體效果
            graphics.fillStyle(color, 1);
            graphics.fillCircle(radius, radius, radius);

            // 加上高光效果
            graphics.fillStyle(0xffffff, 0.3);
            graphics.fillCircle(radius - radius * 0.3, radius - radius * 0.3, radius * 0.3);

            graphics.generateTexture(textureKey, radius * 2, radius * 2);
            graphics.destroy();
        }

        // 建立物理 Sprite
        const ball = this.physics.add.sprite(x, y, textureKey);

        // 設定物理屬性
        ball.setBounce(1, 1);                    // 完全彈性碰撞
        ball.setCollideWorldBounds(true);        // 牆壁碰撞
        ball.setCircle(radius);                  // 圓形碰撞體
        ball.setDrag(0);                         // 無阻力
        ball.setFriction(0, 0);                  // 無摩擦力

        // 設定質量與半徑成正比（面積比例）
        const mass = (radius / COLLISION_CONFIG.balls.minRadius) ** 2;
        ball.setMass(mass);

        return ball;
    }

    private createUI(): void {
        // 標題
        this.add.text(COLLISION_CONFIG.width / 2, 20, '⚪ 基礎碰撞 - 完全彈性碰撞', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // 說明
        this.add.text(10, COLLISION_CONFIG.height - 50, '球與球、球與牆壁皆為完全彈性碰撞（無能量損失）', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#aaaaaa'
        });

        // 資訊文字
        this.infoText = this.add.text(10, COLLISION_CONFIG.height - 30, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#00ff88'
        });
    }

    private updateInfo(): void {
        // 計算總動能（用於驗證能量守恆）
        let totalKE = 0;
        for (const ball of this.balls) {
            const vx = ball.body?.velocity.x || 0;
            const vy = ball.body?.velocity.y || 0;
            const mass = ball.body?.mass || 1;
            const speed = Math.sqrt(vx * vx + vy * vy);
            totalKE += 0.5 * mass * speed * speed;
        }

        this.infoText.setText(`球數: ${this.balls.length} | 總動能: ${totalKE.toFixed(0)}`);
    }
}
