import { type Particle, type KeyState } from './types';
import { showOverlay, hideOverlay, updateParticles, drawParticles, drawRoundedRect } from './GameUtils';
import { StairsGameCore, type Stair, type Action, type GameState } from './StairsGameCore';
import type { StairsWeightsAgent } from '@/lib/ai/agents/StairsWeightsAgent';

// === 渲染用的擴展型別 ===
interface RenderStair extends Stair {
    color: string;
}

interface Star {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
}

// 樓梯顏色對照表
const STAIR_COLORS: Record<Stair['type'], string> = {
    normal: '#78c2ad',
    bounce: '#5cb85c',
    fragile: '#d9534f',
    moving: '#9b59b6'
};

// === 遊戲類別 ===
export class StairsGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // 遊戲核心 (純邏輯)
    private core: StairsGameCore;

    // 渲染用狀態
    private particles: Particle[] = [];
    private stars: Star[] = [];
    private expression: string = '😊';
    private highScore = 0;
    private uiGameState: 'start' | 'playing' | 'paused' | 'gameover' = 'start';
    private keys: KeyState = { left: false, right: false };

    // AI 模式
    private aiMode: 'rule' | 'rl' | false = false;
    private rlAgent: StairsWeightsAgent | null = null;
    private lastAIAction: 'left' | 'right' | 'stop' = 'stop';
    private lockedAction: 'left' | 'right' | null = null;
    private lockedStairIndex: number | null = null;

    // 常數 (從 Core 同步，用於 AI 模擬)
    private readonly GRAVITY = 0.3;
    private readonly MOVE_SPEED = 5;
    private readonly STAIR_HEIGHT = 12;

    // 事件處理器 refs (destroy() 用)
    private onKeyDown!: (e: KeyboardEvent) => void;
    private onKeyUp!: (e: KeyboardEvent) => void;
    private onTouchStart!: (e: TouchEvent) => void;
    private onTouchMove!: (e: TouchEvent) => void;
    private onTouchEnd!: () => void;
    private onStartClick!: () => void;
    private onAIStartClick!: () => void;
    private onRestartClick!: () => void;

    constructor(rlAgent?: StairsWeightsAgent) {
        this.rlAgent = rlAgent || null;
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        // 初始化遊戲核心
        this.core = new StairsGameCore({
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        });

        this.highScore = parseInt(localStorage.getItem('stairsHighScore') || '0');

        this.initStars();
        this.bindEvents();
        this.gameLoop();
    }

    private initStars() {
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.2,
                opacity: Math.random() * 0.5 + 0.3
            });
        }
    }

    private bindEvents() {
        // 建立可移除的事件處理器 — 用實體屬性而非 inline arrow，
        // 讓 destroy() 能精準拆掉。本來只 cancelAnimationFrame、
        // 沒拆 listener，切到 RL 模式建第二個實例後同一個按鍵會被
        // 兩個 game 重複處理。
        this.onStartClick = () => this.startGame(false);
        this.onAIStartClick = () => this.startGame('rule');
        this.onRestartClick = () => this.startGame(this.aiMode);
        document.getElementById('startBtn')?.addEventListener('click', this.onStartClick);
        document.getElementById('aiStartBtn')?.addEventListener('click', this.onAIStartClick);
        document.getElementById('restartBtn')?.addEventListener('click', this.onRestartClick);

        this.onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
            if (e.key === ' ') {
                e.preventDefault();
                if (this.uiGameState === 'playing') {
                    this.uiGameState = 'paused';
                    showOverlay('pauseScreen');
                } else if (this.uiGameState === 'paused') {
                    this.uiGameState = 'playing';
                    hideOverlay('pauseScreen');
                }
            }
        };
        this.onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
        };
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);

        // 觸控支援
        let touchStartX = 0;
        this.onTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
        };
        this.onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const touchX = e.touches[0].clientX;
            const diff = touchX - touchStartX;
            this.keys.left = diff < -10;
            this.keys.right = diff > 10;
        };
        this.onTouchEnd = () => {
            this.keys.left = false;
            this.keys.right = false;
        };
        this.canvas.addEventListener('touchstart', this.onTouchStart);
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd);
    }

    public startGame(aiMode: 'rule' | 'rl' | false = false) {
        this.aiMode = aiMode;
        this.core.reset();
        this.particles = [];
        this.expression = '😊';
        this.lockedAction = null;
        this.lockedStairIndex = null;
        this.uiGameState = 'playing';
        hideOverlay('startScreen');
        hideOverlay('gameOverScreen');

        // 顯示/隱藏 AI 指示器
        const aiIndicator = document.getElementById('aiIndicator');
        if (aiIndicator) {
            aiIndicator.classList.toggle('hidden', !this.aiMode);
            // 更新 AI 指示器文字
            if (this.aiMode === 'rl') {
                aiIndicator.textContent = '🧠 ';
            } else if (this.aiMode === 'rule') {
                aiIndicator.textContent = '🤖 ';
            }
        }
    }

    private spawnParticles(x: number, y: number, color: string, count: number) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                color: color,
                size: Math.random() * 4 + 2
            });
        }
    }

    // === AI 邏輯 ===
    private updateAI() {
        const state = this.core.getState();
        const currentStairIndex = this.findCurrentStairIndex(state);

        // 檢查是否需要解除鎖定
        if (this.lockedAction !== null) {
            if (!state.player.onStair || currentStairIndex !== this.lockedStairIndex) {
                this.lockedAction = null;
                this.lockedStairIndex = null;
            } else {
                this.keys.left = this.lockedAction === 'left';
                this.keys.right = this.lockedAction === 'right';
                return;
            }
        }

        const bestMove = this.findBestMove(state, currentStairIndex);

        if (bestMove) {
            this.keys.left = bestMove.action === 'left';
            this.keys.right = bestMove.action === 'right';
            this.lastAIAction = bestMove.action;

            if (bestMove.action !== 'stop' && currentStairIndex !== null && bestMove.score > -5000) {
                this.lockedAction = bestMove.action;
                this.lockedStairIndex = currentStairIndex;
            }
        } else {
            const centerDiff = this.canvas.width / 2 - state.player.x;
            this.keys.left = centerDiff < -10;
            this.keys.right = centerDiff > 10;
        }
    }

    private findBestMove(state: GameState, currentStairIndex: number | null): { action: 'left' | 'right' | 'stop', score: number } | null {
        const candidates: { action: 'left' | 'right' | 'stop', score: number }[] = [];
        const actions: ('left' | 'right' | 'stop')[] = ['left', 'right', 'stop'];
        const SIM_FRAMES = 90;

        for (const action of actions) {
            let score = 0;

            let sim = {
                x: state.player.x,
                y: state.player.y,
                vx: state.player.vx,
                vy: state.player.vy,
                onStair: state.player.onStair,
                radius: state.player.radius
            };

            let lowestY = sim.y;
            let landedStairIndex: number | null = null;
            let survived = false;

            for (let frame = 0; frame < SIM_FRAMES; frame++) {
                if (action === 'left') sim.vx = -this.MOVE_SPEED;
                else if (action === 'right') sim.vx = this.MOVE_SPEED;
                else sim.vx *= 0.8;

                sim.x += sim.vx;
                sim.x = Math.max(sim.radius, Math.min(sim.x, this.canvas.width - sim.radius));

                if (!sim.onStair) {
                    sim.vy += this.GRAVITY;
                }
                sim.y += sim.vy;
                sim.y -= state.scrollSpeed;

                if (sim.y > lowestY) lowestY = sim.y;

                sim.onStair = false;
                for (let i = 0; i < state.stairs.length; i++) {
                    const stair = state.stairs[i];
                    if (stair.broken) continue;

                    let stairX = stair.x;
                    let stairY = stair.y - state.scrollSpeed * frame;

                    if (stair.type === 'moving' && stair.moveDir) {
                        stairX += stair.moveDir * 2 * frame;
                        if (stairX < 10) stairX = 10;
                        if (stairX + stair.width > this.canvas.width - 10) stairX = this.canvas.width - 10 - stair.width;
                    }

                    const pBottom = sim.y + sim.radius;
                    if (sim.x > stairX - sim.radius &&
                        sim.x < stairX + stair.width + sim.radius &&
                        pBottom >= stairY &&
                        pBottom <= stairY + this.STAIR_HEIGHT + Math.max(sim.vy, 1)) {

                        if (sim.vy >= 0) {
                            sim.y = stairY - sim.radius;
                            sim.vy = 0;
                            sim.onStair = true;
                            landedStairIndex = i;
                            if (stair.type !== 'fragile') survived = true;

                            if (stair.type === 'moving' && stair.moveDir) {
                                sim.x += stair.moveDir * 2;
                            }
                        }
                    }
                }

                if (sim.y < -20) {
                    score = -20000;
                    break;
                }
                if (sim.y > this.canvas.height + 50) {
                    score = -5000 + (frame * 10);
                    break;
                }

                if (sim.onStair && landedStairIndex !== null && landedStairIndex !== currentStairIndex && survived) {
                    break;
                }
            }

            if (score > -5000) {
                score += (lowestY / this.canvas.height) * 500;

                if (landedStairIndex !== null) {
                    const landedStair = state.stairs[landedStairIndex];
                    if (landedStair.type === 'normal') score += 300;
                    else if (landedStair.type === 'moving') score += 200;
                    else if (landedStair.type === 'bounce') score += 50;
                    else if (landedStair.type === 'fragile') score -= 300;
                }

                if (landedStairIndex !== null && landedStairIndex !== currentStairIndex) {
                    score += 500;
                }

                if (action === 'stop' && currentStairIndex !== null) {
                    const currentStair = state.stairs[currentStairIndex];
                    if (currentStair && currentStair.type !== 'fragile' && state.player.y > 300) {
                        score += 100;
                    }
                }

                if (action === this.lastAIAction && action !== 'stop') {
                    score += 150;
                }
            }

            candidates.push({ action, score });
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates.length > 0 ? candidates[0] : null;
    }

    private findCurrentStairIndex(state: GameState): number | null {
        for (let i = 0; i < state.stairs.length; i++) {
            const stair = state.stairs[i];
            if (stair.broken) continue;
            const pBottom = state.player.y + state.player.radius;
            if (state.player.x > stair.x - state.player.radius &&
                state.player.x < stair.x + stair.width + state.player.radius &&
                Math.abs(pBottom - stair.y) < 10) {
                return i;
            }
        }
        return null;
    }

    // === RL AI 邏輯 ===
    private updateRLAI() {
        if (!this.rlAgent) {
            console.warn('RL agent not available, falling back to manual control');
            return;
        }

        const state = this.core.getState();

        // 異步預測（使用 Promise，但不阻塞遊戲循環）
        this.rlAgent.predict(state).then(result => {
            // 根據預測結果設置按鍵
            this.keys.left = result.action === 'left';
            this.keys.right = result.action === 'right';

            // 記錄動作用於調試
            this.lastAIAction = result.action === 'none' ? 'stop' : result.action;
        }).catch(error => {
            console.error('RL AI prediction error:', error);
            // 發生錯誤時停止移動
            this.keys.left = false;
            this.keys.right = false;
        });
    }

    private update() {
        if (this.uiGameState !== 'playing') return;

        // AI 控制
        if (this.aiMode === 'rule') {
            this.updateAI();
        } else if (this.aiMode === 'rl') {
            this.updateRLAI();
        }

        // 記錄更新前的狀態，用於粒子效果
        const prevState = this.core.getState();
        const prevBrokenStairs = new Set(
            prevState.stairs.filter(s => s.broken).map((_, i) => i)
        );

        // 決定動作
        let action: Action = 'none';
        if (this.keys.left) action = 'left';
        else if (this.keys.right) action = 'right';

        // 執行遊戲邏輯
        const result = this.core.step(action);
        const state = result.observation;

        // 檢測樓梯破碎事件，產生粒子效果
        for (let i = 0; i < state.stairs.length; i++) {
            const stair = state.stairs[i];
            if (stair.broken && !prevBrokenStairs.has(i)) {
                // 新破碎的樓梯
                this.spawnParticles(stair.x + stair.width / 2, stair.y, STAIR_COLORS.fragile, 15);
                this.expression = '😱';
            }
        }

        // 檢測彈跳樓梯事件
        if (state.player.vy < -10 && prevState.player.vy >= 0) {
            this.spawnParticles(state.player.x, state.player.y + state.player.radius, STAIR_COLORS.bounce, 8);
            this.expression = '😮';
        }

        // 正常站立時的表情
        if (state.player.onStair && state.player.vy === 0 && this.expression !== '😊') {
            this.expression = '😊';
        }

        // 更新粒子
        this.particles = updateParticles(this.particles);

        // 更新星星
        for (const star of this.stars) {
            star.y -= star.speed;
            if (star.y < 0) {
                star.y = this.canvas.height;
                star.x = Math.random() * this.canvas.width;
            }
        }

        // 更新分數顯示
        document.getElementById('scoreDisplay')!.textContent = state.score.toString();

        // 檢查遊戲結束
        if (state.gameOver) {
            this.handleGameOver(state);
        }
    }

    private handleGameOver(state: GameState) {
        this.uiGameState = 'gameover';
        this.spawnParticles(state.player.x, state.player.y, '#fff', 30);

        if (state.score > this.highScore) {
            this.highScore = state.score;
            localStorage.setItem('stairsHighScore', this.highScore.toString());
        }

        document.getElementById('finalScore')!.textContent = state.score.toString();
        document.getElementById('highScore')!.textContent = this.highScore.toString();
        showOverlay('gameOverScreen');
    }

    private draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const state = this.core.getState();

        // 背景漸層
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // 星星
        for (const star of this.stars) {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // 樓梯
        const stairHeight = this.core.getStairHeight();
        for (const stair of state.stairs) {
            if (stair.broken) continue;

            const color = STAIR_COLORS[stair.type];
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;

            drawRoundedRect(ctx, stair.x, stair.y, stair.width, stairHeight, 6);

            ctx.shadowBlur = 0;
        }

        // 粒子
        drawParticles(ctx, this.particles);

        // 玩家
        if (this.uiGameState === 'playing' || this.uiGameState === 'paused') {
            // 身體
            ctx.fillStyle = '#ffcc5c';
            ctx.shadowColor = '#ffcc5c';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 表情
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.expression, state.player.x, state.player.y);
        }

        // 危險區域提示
        if (this.uiGameState === 'playing') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctx.fillRect(0, 0, w, 30);
            ctx.fillRect(0, h - 30, w, 30);
        }
    }

    private animationFrameId: number | null = null;

    private gameLoop = () => {
        this.update();
        this.draw();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    /**
     * 停止遊戲循環並清理資源
     */
    public destroy() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        document.getElementById('startBtn')?.removeEventListener('click', this.onStartClick);
        document.getElementById('aiStartBtn')?.removeEventListener('click', this.onAIStartClick);
        document.getElementById('restartBtn')?.removeEventListener('click', this.onRestartClick);
        console.log('🧹 StairsGame instance destroyed');
    }
}
