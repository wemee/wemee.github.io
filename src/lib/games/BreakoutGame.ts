import { type Particle, type KeyState } from './types';
import { showOverlay, hideOverlay, updateParticles, drawParticles, drawRoundedRect } from './GameUtils';

// === 型別定義 ===
interface Brick {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    hits: number;
    maxHits: number;
    points: number;
}

interface PowerUp {
    x: number;
    y: number;
    type: 'wide' | 'multi' | 'slow';
    color: string;
}

// === 遊戲類別 ===
export class BreakoutGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // 遊戲物件
    private ball = { x: 240, y: 450, radius: 8, dx: 0, dy: 0, speed: 7 };

    // 速度設定
    private readonly MIN_SPEED = 7;
    private readonly MAX_SPEED = 14;
    private readonly AI_MIN_SPEED = 10;  // AI 模式初始速度更快
    private readonly AI_MAX_SPEED = 18;
    private readonly SPEED_INCREMENT = 0.15;
    private paddle = { x: 190, y: 560, width: 100, height: 12 };
    private bricks: Brick[] = [];
    private particles: Particle[] = [];
    private powerUps: PowerUp[] = [];

    // 狀態
    private score = 0;
    private lives = 3;
    private level = 1;
    private gameState: 'start' | 'ready' | 'playing' | 'win' | 'gameover' = 'start';
    private ballLaunched = false;

    // 持續按鍵狀態
    private keys: KeyState = { left: false, right: false };
    private readonly PADDLE_SPEED = 10;

    // AI 模式
    private aiMode = false;
    private readonly AI_PADDLE_SPEED = 12;

    // 顏色方案
    private readonly COLORS = [
        '#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#ff9ff3', '#54a0ff'
    ];

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.bindEvents();
        this.gameLoop();
    }

    private createBricks() {
        this.bricks = [];
        const rows = 4 + Math.min(this.level, 4);
        const cols = 8;
        const brickWidth = 52;
        const brickHeight = 20;
        const padding = 6;
        const offsetX = 12;
        const offsetY = 50;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const maxHits = row < 2 && this.level > 1 ? 2 : 1;
                this.bricks.push({
                    x: offsetX + col * (brickWidth + padding),
                    y: offsetY + row * (brickHeight + padding),
                    width: brickWidth,
                    height: brickHeight,
                    color: this.COLORS[row % this.COLORS.length],
                    hits: 0,
                    maxHits: maxHits,
                    points: (rows - row) * 10 * maxHits
                });
            }
        }
    }

    private initGame() {
        this.paddle = { x: this.canvas.width / 2 - 50, y: 560, width: 100, height: 12 };
        this.particles = [];
        this.powerUps = [];
        this.ballLaunched = false;
        this.createBricks();
        this.resetBall();
    }

    private resetBall() {
        this.ballLaunched = false;
        this.ball.x = this.paddle.x + this.paddle.width / 2;
        this.ball.y = this.paddle.y - this.ball.radius - 2;
        this.ball.dx = 0;
        this.ball.dy = 0;

        // AI 模式球速更快
        const baseSpeed = this.aiMode ? this.AI_MIN_SPEED : this.MIN_SPEED;
        this.ball.speed = baseSpeed + this.level * 0.5;
    }

    private launchBall() {
        if (this.ballLaunched) return;

        // 發球時重置 AI 預測快取，確保重新計算落點
        this.cachedLandingX = null;

        this.ballLaunched = true;
        const angle = (Math.random() - 0.5) * Math.PI * 0.5; // -45 到 45 度
        this.ball.dx = this.ball.speed * Math.sin(angle);
        this.ball.dy = -this.ball.speed * Math.cos(angle);
    }

    private bindEvents() {
        document.getElementById('startBtn')?.addEventListener('click', () => this.startGame(false));
        document.getElementById('aiStartBtn')?.addEventListener('click', () => this.startGame(true));
        document.getElementById('restartBtn')?.addEventListener('click', () => {
            this.level = 1;
            this.score = 0;
            this.lives = 3;
            this.startGame(this.aiMode);
        });
        document.getElementById('nextLevelBtn')?.addEventListener('click', () => {
            this.level++;
            this.lives = Math.min(this.lives + 1, 5);
            this.startGame(this.aiMode);
        });

        // 鍵盤控制 - 持續移動
        document.addEventListener('keydown', (e) => {
            if (this.gameState !== 'ready' && this.gameState !== 'playing') return;

            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                this.keys.left = true;
            }
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                this.keys.right = true;
            }
            if (e.key === ' ') {
                e.preventDefault();
                if (!this.ballLaunched) {
                    this.launchBall();
                    this.gameState = 'playing';
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                this.keys.left = false;
            }
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                this.keys.right = false;
            }
        });

        // 滑鼠控制
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.gameState !== 'ready' && this.gameState !== 'playing') return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            this.paddle.x = (e.clientX - rect.left) * scaleX - this.paddle.width / 2;
            this.paddle.x = Math.max(0, Math.min(this.paddle.x, this.canvas.width - this.paddle.width));
        });

        // 滑鼠點擊發球
        this.canvas.addEventListener('click', () => {
            if ((this.gameState === 'ready' || this.gameState === 'playing') && !this.ballLaunched) {
                this.launchBall();
                this.gameState = 'playing';
            }
        });

        // 觸控控制
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.gameState !== 'ready' && this.gameState !== 'playing') return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            this.paddle.x = (e.touches[0].clientX - rect.left) * scaleX - this.paddle.width / 2;
            this.paddle.x = Math.max(0, Math.min(this.paddle.x, this.canvas.width - this.paddle.width));
        });

        // 觸控點擊發球
        this.canvas.addEventListener('touchstart', () => {
            if ((this.gameState === 'ready' || this.gameState === 'playing') && !this.ballLaunched) {
                this.launchBall();
                this.gameState = 'playing';
            }
        });
    }

    private startGame(enableAI: boolean = false) {
        this.aiMode = enableAI;
        this.initGame();
        this.gameState = 'ready';
        hideOverlay('startScreen');
        hideOverlay('gameOverScreen');
        hideOverlay('winScreen');
        this.updateHUD();

        // 顯示/隱藏 AI 指示器
        const aiIndicator = document.getElementById('aiIndicator');
        if (aiIndicator) {
            aiIndicator.classList.toggle('hidden', !this.aiMode);
        }

        // AI 模式自動發球
        if (this.aiMode) {
            setTimeout(() => {
                this.launchBall();
                this.gameState = 'playing';
            }, 500);
        }
    }

    // === AI 邏輯 ===
    // AI 預測相關
    private cachedLandingX: number | null = null;
    private targetOffset: number = 0; // AI 預計用板子的哪個部位接球 (-0.5 ~ 0.5)
    private lastBallDy: number = 0;  // 追蹤上一幀的 dy，用於偵測反彈
    private predictionFlashTime: number = 0;  // 預測計算特效時間戳
    private needsRecalcAfterBounce: boolean = false;  // 反彈後需要重算的標記

    private predictBallX(): number {
        // 1. 如果有快取，直接回傳 (最省資源)
        if (this.cachedLandingX !== null) {
            return this.cachedLandingX;
        }

        // 2. 開始全路徑模擬 (Full Path Simulation)
        // 觸發視覺特效，標記正在進行預測計算
        this.predictionFlashTime = Date.now();

        // 複製球的狀態
        let simX = this.ball.x;
        let simY = this.ball.y;
        let simDx = this.ball.dx;
        let simDy = this.ball.dy;
        const radius = this.ball.radius;

        // 追蹤每塊磚塊在模擬中被擊中的次數
        // Key: brick index, Value: 模擬中累積的擊中次數
        const simBrickHits = new Map<number, number>();

        // 模擬步數限制 (防止死迴圈，雖然理論上球一定會掉下來)
        let steps = 0;
        const MAX_STEPS = 5000;

        // 模擬直到球回到板子高度
        while (simY < this.paddle.y - radius && steps < MAX_STEPS) {
            steps++;

            // 移動
            simX += simDx;
            simY += simDy;

            // --- 牆壁碰撞模擬 ---
            if (simX - radius < 0) {
                simX = radius;
                simDx = Math.abs(simDx);
            }
            if (simX + radius > this.canvas.width) {
                simX = this.canvas.width - radius;
                simDx = -Math.abs(simDx);
            }
            if (simY - radius < 0) {
                simY = radius;
                simDy = Math.abs(simDy); // 天花板反彈
            }

            // --- 磚塊碰撞模擬 ---
            // 只有當球在磚塊區域時才檢查 (優化效能)
            if (simY < 300) {
                for (let i = this.bricks.length - 1; i >= 0; i--) {
                    const brick = this.bricks[i];

                    // 計算這塊磚塊在模擬中的總擊中次數 (真實 + 模擬)
                    const simHits = simBrickHits.get(i) || 0;
                    const totalHits = brick.hits + simHits;

                    // 如果磚塊在模擬中已被打爆，跳過
                    if (totalHits >= brick.maxHits) continue;

                    // AABB 碰撞檢查
                    if (simX + radius > brick.x &&
                        simX - radius < brick.x + brick.width &&
                        simY + radius > brick.y &&
                        simY - radius < brick.y + brick.height) {

                        // 記錄這次擊中
                        simBrickHits.set(i, simHits + 1);

                        // 決定反彈方向 (使用與遊戲主邏輯相同的判斷)
                        const overlapLeft = (simX + radius) - brick.x;
                        const overlapRight = (brick.x + brick.width) - (simX - radius);
                        const overlapTop = (simY + radius) - brick.y;
                        const overlapBottom = (brick.y + brick.height) - (simY - radius);

                        const minOverlapX = Math.min(overlapLeft, overlapRight);
                        const minOverlapY = Math.min(overlapTop, overlapBottom);
                        const CORNER_TOLERANCE = 4;

                        if (Math.abs(minOverlapX - minOverlapY) < CORNER_TOLERANCE) {
                            simDx *= -1;
                            simDy *= -1;
                        } else if (minOverlapX < minOverlapY) {
                            simDx *= -1;
                        } else {
                            simDy *= -1;
                        }

                        // 在一次 step 中通常只撞一塊，撞到就跳出檢查
                        break;
                    }
                }
            }
        }

        // 儲存結果並回傳
        this.cachedLandingX = simX;

        // 計算完成的同時，隨機決定這次要用板子的哪個部位接球
        // 範圍：-45% 到 +45% (保留 5% 安全邊緣)
        // 這樣能製造不同的反彈角度，避免死循環
        this.targetOffset = (Math.random() - 0.5) * 0.9 * this.paddle.width;

        return simX;
    }

    private findBestPowerUp(): PowerUp | null {
        // 找出最接近且可接到的道具
        let bestPU: PowerUp | null = null;
        let bestScore = -Infinity;

        for (const pu of this.powerUps) {
            // 預測道具落下時的位置
            const timeToReach = (this.paddle.y - pu.y) / 2; // 道具速度為 2
            if (timeToReach <= 0) continue;

            const puX = pu.x;
            const distFromPaddle = Math.abs(puX - (this.paddle.x + this.paddle.width / 2));

            // 只考慮有機會接到的道具
            if (distFromPaddle < 150 && pu.y > 100) {
                const score = pu.y - distFromPaddle * 0.5; // 越近、越快落下的越優先
                if (score > bestScore) {
                    bestScore = score;
                    bestPU = pu;
                }
            }
        }

        return bestPU;
    }

    private updateAI() {
        if (!this.aiMode) return;
        if (this.gameState !== 'playing' && this.gameState !== 'ready') return;

        const paddleCenter = this.paddle.x + this.paddle.width / 2;
        let targetX: number;

        // 如果球黏在板子上 (ready 或剛發球前)，目標就是球的位置
        if (!this.ballLaunched) {
            targetX = this.ball.x;
        } else {
            // 取得預測落點 (使用全路徑模擬)
            const predictedX = this.predictBallX();

            // 目標位置 = 預測落點 - 隨機偏移量
            // (例如：如果想用板子左邊接球，板子就要往右移，所以是減號)
            targetX = predictedX - this.targetOffset;
        }

        // 移動板子
        const diff = targetX - paddleCenter;
        const speed = this.AI_PADDLE_SPEED;

        // 加入 Deadzone (5px) 防止抖動
        if (Math.abs(diff) > 5) {
            if (Math.abs(diff) > speed) {
                this.paddle.x += diff > 0 ? speed : -speed;
            } else {
                this.paddle.x += diff;
            }
        }

        this.paddle.x = Math.max(0, Math.min(this.paddle.x, this.canvas.width - this.paddle.width));
    }

    private findBestPaddlePosition(ballLandX: number): number {
        // 測試不同的接球位置，找出能打到磚塊的最佳位置
        const testPositions = [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4]; // 相對於板子寬度的偏移
        let bestPosition = ballLandX;
        let bestScore = -Infinity;

        for (const offsetRatio of testPositions) {
            // 計算反彈角度（複製自真實反彈邏輯）
            const hitPos = 0.5 + offsetRatio; // 球打在板子的哪個位置 (0-1)
            const angle = (hitPos - 0.5) * Math.PI * 0.6;
            const speed = this.ball.speed;
            const dx = speed * Math.sin(angle);
            const dy = -speed * Math.cos(angle);

            // 模擬球飛出去的軌跡
            const score = this.simulateBallPath(ballLandX, this.paddle.y - this.ball.radius, dx, dy);

            if (score > bestScore) {
                bestScore = score;
                // 最佳接球位置 = 球落點 - 偏移量（讓球打在板子的特定位置）
                bestPosition = ballLandX - offsetRatio * this.paddle.width;
            }
        }

        // 確保位置在有效範圍內
        const halfPaddle = this.paddle.width / 2;
        bestPosition = Math.max(halfPaddle, Math.min(bestPosition, this.canvas.width - halfPaddle));

        return bestPosition;
    }

    private simulateBallPath(startX: number, startY: number, dx: number, dy: number): number {
        // 模擬球的軌跡，計算能打到多少磚塊的分數
        let x = startX;
        let y = startY;
        let score = 0;
        const hitBricks = new Set<number>();

        // 最多模擬 500 步
        for (let step = 0; step < 500; step++) {
            x += dx;
            y += dy;

            // 牆壁反彈
            if (x - this.ball.radius < 0) {
                x = this.ball.radius;
                dx = Math.abs(dx);
            }
            if (x + this.ball.radius > this.canvas.width) {
                x = this.canvas.width - this.ball.radius;
                dx = -Math.abs(dx);
            }
            if (y - this.ball.radius < 0) {
                y = this.ball.radius;
                dy = Math.abs(dy);
            }

            // 檢查是否打到磚塊
            for (let i = 0; i < this.bricks.length; i++) {
                if (hitBricks.has(i)) continue;
                const brick = this.bricks[i];

                if (x + this.ball.radius > brick.x &&
                    x - this.ball.radius < brick.x + brick.width &&
                    y + this.ball.radius > brick.y &&
                    y - this.ball.radius < brick.y + brick.height) {
                    hitBricks.add(i);
                    score += brick.points;

                    // 這裡的模擬僅用於評分，為了效能省略精確反彈計算，直接反轉 dy
                    // 若要更精確，可複製上面的精確碰撞邏輯，但對評分來說影響不大
                    dy = -dy;
                }
            }

            // 球回到板子高度就停止模擬
            if (y > this.paddle.y) break;
        }

        return score;
    }

    private updateHUD() {
        document.getElementById('scoreDisplay')!.textContent = this.score.toString();
        document.getElementById('livesDisplay')!.textContent = '❤️'.repeat(this.lives);
        document.getElementById('levelDisplay')!.textContent = this.level.toString();
    }

    private spawnParticles(x: number, y: number, color: string, count: number) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                color: color,
                size: Math.random() * 5 + 2
            });
        }
    }

    private spawnPowerUp(x: number, y: number) {
        if (Math.random() < 0.15) {
            const types: PowerUp['type'][] = ['wide', 'multi', 'slow'];
            const type = types[Math.floor(Math.random() * types.length)];
            const colors = { wide: '#1dd1a1', multi: '#ff9ff3', slow: '#54a0ff' };
            this.powerUps.push({ x, y, type, color: colors[type] });
        }
    }

    private update() {
        if (this.gameState !== 'ready' && this.gameState !== 'playing') return;

        // AI 控制
        this.updateAI();

        // 持續按鍵移動板子
        if (this.keys.left) {
            this.paddle.x -= this.PADDLE_SPEED;
        }
        if (this.keys.right) {
            this.paddle.x += this.PADDLE_SPEED;
        }
        this.paddle.x = Math.max(0, Math.min(this.paddle.x, this.canvas.width - this.paddle.width));

        // 如果球還沒發射，跟著板子移動
        if (!this.ballLaunched) {
            this.ball.x = this.paddle.x + this.paddle.width / 2;
            this.ball.y = this.paddle.y - this.ball.radius - 2;
            return; // 不更新其他物理
        }

        // 移動球
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;

        // 牆壁碰撞（修正位置避免卡住）
        if (this.ball.x - this.ball.radius < 0) {
            this.ball.x = this.ball.radius;
            this.ball.dx = Math.abs(this.ball.dx);
        }
        if (this.ball.x + this.ball.radius > this.canvas.width) {
            this.ball.x = this.canvas.width - this.ball.radius;
            this.ball.dx = -Math.abs(this.ball.dx);
        }
        if (this.ball.y - this.ball.radius < 0) {
            this.ball.y = this.ball.radius;
            this.ball.dy = Math.abs(this.ball.dy);
        }

        // 掉落
        if (this.ball.y + this.ball.radius > this.canvas.height) {
            this.lives--;
            this.updateHUD();
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.resetBall();
                this.gameState = 'ready';
            }
        }

        // 板子碰撞
        if (this.ball.y + this.ball.radius > this.paddle.y &&
            this.ball.y - this.ball.radius < this.paddle.y + this.paddle.height &&
            this.ball.x + this.ball.radius > this.paddle.x &&
            this.ball.x - this.ball.radius < this.paddle.x + this.paddle.width) {

            // 快取清除邏輯已移到 update 最後統一處理

            // 每次碰到板子加速
            this.ball.speed = Math.min(this.ball.speed + this.SPEED_INCREMENT, this.MAX_SPEED);

            // 根據擊中位置調整反彈角度
            const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
            const angle = (hitPos - 0.5) * Math.PI * 0.6;
            const speed = this.ball.speed;

            this.ball.dx = speed * Math.sin(angle);
            this.ball.dy = -speed * Math.cos(angle);
            this.ball.y = this.paddle.y - this.ball.radius;
        }

        // 磚塊碰撞
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];

            if (this.ball.x + this.ball.radius > brick.x &&
                this.ball.x - this.ball.radius < brick.x + brick.width &&
                this.ball.y + this.ball.radius > brick.y &&
                this.ball.y - this.ball.radius < brick.y + brick.height) {

                // 計算重疊量以判斷碰撞方向
                const overlapLeft = (this.ball.x + this.ball.radius) - brick.x;
                const overlapRight = (brick.x + brick.width) - (this.ball.x - this.ball.radius);
                const overlapTop = (this.ball.y + this.ball.radius) - brick.y;
                const overlapBottom = (brick.y + brick.height) - (this.ball.y - this.ball.radius);

                const minOverlapX = Math.min(overlapLeft, overlapRight);
                const minOverlapY = Math.min(overlapTop, overlapBottom);

                // 角落碰撞容許值 (像素)
                const CORNER_TOLERANCE = 4;

                if (Math.abs(minOverlapX - minOverlapY) < CORNER_TOLERANCE) {
                    // 打在角上：同時反轉
                    this.ball.dx *= -1;
                    this.ball.dy *= -1;
                } else if (minOverlapX < minOverlapY) {
                    // 側面碰撞 (左右)：反轉水平速度
                    this.ball.dx *= -1;
                } else {
                    // 上下碰撞：反轉垂直速度
                    this.ball.dy *= -1;
                }

                brick.hits++;

                if (brick.hits >= brick.maxHits) {
                    this.score += brick.points;
                    this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 12);
                    this.spawnPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
                    this.bricks.splice(i, 1);
                }

                this.updateHUD();
                break;
            }
        }

        // 道具移動和碰撞
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            pu.y += 2;

            // 碰到板子
            if (pu.y > this.paddle.y && pu.y < this.paddle.y + this.paddle.height &&
                pu.x > this.paddle.x && pu.x < this.paddle.x + this.paddle.width) {

                if (pu.type === 'wide') {
                    this.paddle.width = Math.min(this.paddle.width + 30, 180);
                } else if (pu.type === 'slow') {
                    this.ball.speed = Math.max(this.ball.speed - 1, 3);
                }

                this.spawnParticles(pu.x, pu.y, pu.color, 8);
                this.powerUps.splice(i, 1);
                continue;
            }

            // 掉出畫面
            if (pu.y > this.canvas.height) {
                this.powerUps.splice(i, 1);
            }
        }

        // 更新粒子
        this.particles = updateParticles(this.particles, 0.2, 0.03);

        // 過關檢測
        if (this.bricks.length === 0) {
            this.win();
        }

        // AI 預測快取管理（兩階段觸發）
        // 階段 1：偵測球在下半場的反彈（dy 從正變負）
        const BRICK_ZONE_BOTTOM = 350;
        if (this.ball.y > BRICK_ZONE_BOTTOM && this.lastBallDy > 0 && this.ball.dy < 0) {
            this.needsRecalcAfterBounce = true;  // 標記需要重算
        }

        // 階段 2：等球飛到安全高度後再清除快取
        // 這樣計算時球已經穩定飛行，模擬迴圈能正常運作
        const SAFE_HEIGHT = 450;  // 安全高度：已離開板子區域
        if (this.needsRecalcAfterBounce && this.ball.y < SAFE_HEIGHT && this.ball.dy < 0) {
            this.cachedLandingX = null;
            this.needsRecalcAfterBounce = false;
        }

        this.lastBallDy = this.ball.dy;
    }

    private win() {
        this.gameState = 'win';
        document.getElementById('winScore')!.textContent = this.score.toString();

        // AI 模式自動進入下一關
        if (this.aiMode) {
            this.level++;
            this.lives = Math.min(this.lives + 1, 5);
            setTimeout(() => {
                this.startGame(true);
            }, 1000);
        } else {
            showOverlay('winScreen');
        }
    }

    private gameOver() {
        this.gameState = 'gameover';
        document.getElementById('finalScore')!.textContent = this.score.toString();
        showOverlay('gameOverScreen');
    }

    private draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 背景
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#0f0c29');
        gradient.addColorStop(0.5, '#302b63');
        gradient.addColorStop(1, '#24243e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // 磚塊
        for (const brick of this.bricks) {
            const alpha = brick.maxHits > 1 && brick.hits > 0 ? 0.5 : 1;
            ctx.fillStyle = brick.color;
            ctx.globalAlpha = alpha;
            ctx.shadowColor = brick.color;
            ctx.shadowBlur = 8;

            drawRoundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 4);

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        // 道具
        for (const pu of this.powerUps) {
            ctx.fillStyle = pu.color;
            ctx.beginPath();
            ctx.arc(pu.x, pu.y, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icons: Record<PowerUp['type'], string> = { wide: '↔', multi: '⚡', slow: '🐢' };
            ctx.fillText(icons[pu.type], pu.x, pu.y);
        }

        // 粒子
        drawParticles(ctx, this.particles);

        // 板子
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        drawRoundedRect(ctx, this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 6);
        ctx.shadowBlur = 0;

        // 球
        const ballGradient = ctx.createRadialGradient(
            this.ball.x - 2, this.ball.y - 2, 0,
            this.ball.x, this.ball.y, this.ball.radius
        );
        ballGradient.addColorStop(0, '#fff');
        ballGradient.addColorStop(1, '#ccc');
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Debug: 顯示 AI 預測落點
        if (this.aiMode && this.cachedLandingX !== null) {
            ctx.strokeStyle = '#ff3333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // 畫一個 X 標記在板子高度 (顯示修正後的實際目標接球點)
            // 因為板子中心要對齊 targetX，所以球實際上會落在 cachedLandingX
            const markX = this.cachedLandingX; // 顯示球的落點
            // 也可以畫出 AI 下一個目標板子中心：this.cachedLandingX - this.targetOffset

            const markY = this.paddle.y + this.paddle.height / 2;
            const size = 10;
            ctx.moveTo(markX - size, markY - size);
            ctx.lineTo(markX + size, markY + size);
            ctx.moveTo(markX + size, markY - size);
            ctx.lineTo(markX - size, markY + size);
            ctx.stroke();

            // 畫一條虛線指向上方
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.5)';
            ctx.beginPath();
            ctx.moveTo(markX, markY - size);
            ctx.lineTo(markX, markY - 100);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Debug: 預測計算特效（黃色閃光圈）
        if (this.aiMode) {
            const elapsed = Date.now() - this.predictionFlashTime;
            const FLASH_DURATION = 200; // 持續 200ms
            if (elapsed < FLASH_DURATION) {
                const alpha = 1 - (elapsed / FLASH_DURATION); // 漸淡
                const radius = 20 + (elapsed / FLASH_DURATION) * 30; // 擴散
                ctx.strokeStyle = `rgba(255, 220, 0, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.paddle.x + this.paddle.width / 2, this.paddle.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    private gameLoop = () => {
        this.update();
        this.draw();
        requestAnimationFrame(this.gameLoop);
    }
}
