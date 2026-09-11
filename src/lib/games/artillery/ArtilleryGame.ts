/**
 * 《彈道對決》瀏覽器層 — 把 Core 的回合制邏輯接上輸入、動畫與畫面。
 *
 * Core 的 step() 是瞬間完成的（一次 = 一整發），這裡負責把那一發
 * 沿著記錄下來的彈道「播放」出來，播完才把傷害演出來，接著換 AI 出手。
 */

import type { Particle } from '@/lib/games/types';
import { spawnParticles } from '@/lib/games/GameUtils';
import { ArtilleryCore } from './ArtilleryCore';
import { ArtilleryAgent, type ArtilleryPlan } from '@/lib/ai/agents/ArtilleryAgent';
import { ArtilleryRenderer, type Explosion, type Floater } from './renderer';
import { AIM, COMBAT, FIELD, PHYSICS } from './config';
import { aiSigmaForStage, enemyHpForStage } from './stage';
import { clamp, lerp } from './random';
import type { ArtilleryState, ShotOutcome, Side, TurretPose, Vec2 } from './types';

type Phase = 'aiming' | 'flying' | 'impact' | 'enemyAiming' | 'over';

export interface ArtilleryGameCallbacks {
    onStateChange?: (state: ArtilleryState, display: { hp: Record<Side, number>; stage: number }) => void;
    onAimChange?: (aim: { angle: number; power: number }) => void;
    onPhaseChange?: (phase: Phase) => void;
    /** 一關結束。cleared 為 true 代表過關，否則整趟結束 */
    onStageEnd?: (result: { winner: Side | 'draw' | null; cleared: boolean; stage: number }) => void;
}

/** 彈道播放速度倍率（1 = 真實飛行時間） */
const PLAYBACK_SPEED = 1.25;
/** 記錄點的時間間隔換算成每秒播放幾點 */
const POINTS_PER_SECOND = (1 / (PHYSICS.dt * PHYSICS.recordEvery)) * PLAYBACK_SPEED;
/** 落地後停留多久再換手 */
const IMPACT_HOLD = 0.85;
/** AI 轉動砲管瞄準的時間 */
const ENEMY_AIM_TIME = 1.1;
/** 拖曳到滿力所需的距離（實際螢幕像素，所以手機與桌機的手感一致） */
const MAX_DRAG_CSS_PX = 170;
/** 小於這個拖曳距離視為「只是點一下」，不當成瞄準 */
const MIN_DRAG_CSS_PX = 8;
/** 中彈反應（彈跳＋晃動＋滑到新位置）的長度 */
const HIT_REACTION = 0.55;

export class ArtilleryGame {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: ArtilleryRenderer;
    private readonly callbacks: ArtilleryGameCallbacks;
    private core!: ArtilleryCore;
    private agent!: ArtilleryAgent;
    /** 目前關卡，從 1 開始 */
    private stage = 1;

    private phase: Phase = 'aiming';
    private aim = { angle: 45, power: 60 };
    private barrel: Record<Side, number> = { player: 45, enemy: 45 };
    private displayHp: Record<Side, number> = { player: COMBAT.maxHp, enemy: COMBAT.maxHp };

    private particles: Particle[] = [];
    private explosions: Explosion[] = [];
    private floaters: Floater[] = [];
    private shake = 0;

    private flight: { points: Vec2[]; cursor: number; outcome: ShotOutcome } | null = null;
    private trail: Vec2[] = [];
    private impactTimer = 0;
    private enemyAimTimer = 0;
    private enemyPlan: ArtilleryPlan | null = null;
    private enemyAimFrom = 45;

    private preview: Vec2[] = [];
    private previewKey = '';

    /** 顯示用的回合數。Core 在開火當下就換手加一了，畫面要等砲彈落地才跟上 */
    private displayRound = 1;

    /** 中彈反應動畫。Core 已經把砲台移到新位置，這裡負責從舊位置演過去 */
    private hitReaction: Partial<Record<Side, { fromX: number; elapsed: number; hop: number; shake: number }>> = {};

    private inputLocked = true;
    /** 拖曳以「按下的那一點」為錨點，不是砲台本身 —— 否則畫面上隨便點一下都會開火 */
    private drag: { start: Vec2; pointer: Vec2; aimBefore: { angle: number; power: number } } | null = null;

    private rafId = 0;
    private lastTime = 0;
    private resizeTimer = 0;

    private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
    private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
    private readonly onPointerUp = () => this.handlePointerUp();
    private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
    private readonly onResize = () => this.handleResize();

    constructor(canvas: HTMLCanvasElement, callbacks: ArtilleryGameCallbacks = {}) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this.renderer = new ArtilleryRenderer(canvas);

        this.renderer.resize();
        this.startRun();
        this.bindEvents();
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame((time) => this.loop(time));
    }

    /** 從第一關重新開始一趟 */
    startRun(): void {
        this.stage = 1;
        this.startStage();
    }

    /** 過關，前往下一關 */
    nextStage(): void {
        this.stage += 1;
        this.startStage();
    }

    /**
     * 開始目前這一關：換地形、雙方回滿血、玩家先手。
     * 敵方血量與 AI 誤差都跟著關卡走，所以每關重建 Core 與 Agent。
     */
    private startStage(): void {
        this.core = new ArtilleryCore({
            width: FIELD.width,
            height: FIELD.height,
            enemyMaxHp: enemyHpForStage(this.stage),
        });
        this.agent = new ArtilleryAgent({ core: this.core, ...aiSigmaForStage(this.stage) });

        this.phase = 'aiming';
        this.aim = { angle: 45, power: 60 };
        this.barrel = { player: 45, enemy: 45 };
        const turrets = this.core.getState().turrets;
        this.displayHp = { player: turrets.player.hp, enemy: turrets.enemy.hp };
        this.displayRound = 1;
        this.particles = [];
        this.explosions = [];
        this.floaters = [];
        this.flight = null;
        this.trail = [];
        this.shake = 0;
        this.preview = [];
        this.previewKey = '';
        this.enemyPlan = null;
        this.drag = null;
        this.hitReaction = {};

        this.renderer.buildBackground(this.core.getState());
        this.emitState();
        this.callbacks.onAimChange?.({ ...this.aim });
        this.callbacks.onPhaseChange?.(this.phase);
    }

    setAngle(angle: number): void {
        this.aim.angle = clamp(angle, AIM.minAngle, AIM.maxAngle);
        this.barrel.player = this.aim.angle;
        this.callbacks.onAimChange?.({ ...this.aim });
    }

    setPower(power: number): void {
        this.aim.power = clamp(power, AIM.minPower, AIM.maxPower);
        this.callbacks.onAimChange?.({ ...this.aim });
    }

    /** 開火。只有輪到玩家、且沒有砲彈在飛的時候才有效 */
    fire(): void {
        if (!this.isPlayerTurn() || this.aim.power < 3) return;
        this.shoot({ angle: this.aim.angle, power: this.aim.power });
    }

    /** 開場說明蓋在畫面上時先鎖住輸入，避免隔著遮罩用鍵盤開火 */
    setInputLocked(locked: boolean): void {
        this.inputLocked = locked;
    }

    isPlayerTurn(): boolean {
        return !this.inputLocked && this.phase === 'aiming' && this.core.getState().turn === 'player';
    }

    /**
     * 瞄準值可不可以改。刻意跟「能不能開火」分開：
     * 對手回合時仍然可以先把下一發的角度力道調好，但開火還是要等輪到自己。
     */
    canAdjustAim(): boolean {
        return !this.inputLocked && !this.core.getState().over;
    }

    destroy(): void {
        cancelAnimationFrame(this.rafId);
        window.clearTimeout(this.resizeTimer);
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointercancel', this.onPointerUp);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('resize', this.onResize);
    }

    // === 回合流程 ===

    private shoot(action: ArtilleryPlan): void {
        const result = this.core.step(action);
        const outcome = result.observation.lastShot;
        if (!outcome) return;

        this.barrel[outcome.shooter] = outcome.angle;
        this.flight = { points: outcome.points, cursor: 0, outcome };
        this.trail = [];
        this.drag = null;
        this.setPhase('flying');
    }

    private onFlightEnd(outcome: ShotOutcome): void {
        if (outcome.impact) {
            this.explosions.push({
                x: outcome.impact.x,
                y: outcome.impact.y,
                age: 0,
                duration: 0.55,
                radius: COMBAT.blastRadius * 0.75,
            });
            spawnParticles(this.particles, outcome.impact.x, outcome.impact.y, '#cb4b16', 22);
            spawnParticles(this.particles, outcome.impact.x, outcome.impact.y, '#b58900', 14);
        }

        // 打得越重，畫面震得越兇；打偏也還是有基本的落地震動
        const heaviest = Math.max(outcome.damage.player, outcome.damage.enemy);
        this.shake = outcome.impact ? 6 + heaviest * 0.25 : 0;

        const state = this.core.getState();
        for (const side of ['player', 'enemy'] as Side[]) {
            const damage = outcome.damage[side];
            if (damage <= 0) continue;
            const turret = state.turrets[side];

            this.hitReaction[side] = {
                fromX: outcome.knockback[side].from.x,
                elapsed: 0,
                hop: 6 + damage * 0.32,
                shake: 2 + damage * 0.11,
            };

            // 被炸飛的碎片用陣營色，看得出是誰挨打
            spawnParticles(this.particles, turret.x, turret.y - 12, side === 'player' ? '#268bd2' : '#cb4b16', 12);

            this.floaters.push({
                x: turret.x,
                y: turret.y - 54,
                text: `-${damage}`,
                color: side === 'player' ? '#dc322f' : '#859900',
                age: 0,
                duration: 1.1,
            });
        }

        this.flight = null;
        this.displayRound = this.core.getState().round;
        this.impactTimer = IMPACT_HOLD;
        this.setPhase('impact');
        this.emitState();
    }

    private afterImpact(): void {
        const state = this.core.getState();

        if (state.over) {
            this.setPhase('over');
            this.callbacks.onStageEnd?.({
                winner: state.winner,
                cleared: state.winner === 'player',
                stage: this.stage,
            });
            return;
        }

        if (state.turn === 'enemy') {
            this.startEnemyTurn();
        } else {
            this.setPhase('aiming');
        }
    }

    private startEnemyTurn(): void {
        this.setPhase('enemyAiming');
        this.enemyAimFrom = this.barrel.enemy;
        this.enemyAimTimer = ENEMY_AIM_TIME;
        this.enemyPlan = null;

        // 讓瞄準動畫先跑起來，再做搜尋；搜尋本身是同步的重運算
        void this.agent
            .predict(this.core.getState())
            .then((result) => {
                this.enemyPlan = result.action;
            })
            // 搜尋失敗也要有東西可打，否則回合會卡在「AI 瞄準中」
            .catch(() => {
                this.enemyPlan = { angle: 45, power: 60 };
            });
    }

    private setPhase(phase: Phase): void {
        this.phase = phase;
        this.callbacks.onPhaseChange?.(phase);
    }

    private emitState(): void {
        this.callbacks.onStateChange?.(this.viewState(), { hp: { ...this.displayHp }, stage: this.stage });
    }

    /** 給畫面看的狀態：回合數用顯示值，避免砲彈還在飛就先跳號 */
    private viewState(): ArtilleryState {
        return { ...this.core.getState(), round: this.displayRound };
    }

    // === 主迴圈 ===

    private loop(time: number): void {
        const dt = Math.min((time - this.lastTime) / 1000, 0.05);
        this.lastTime = time;

        this.update(dt);
        this.render(time);

        this.rafId = requestAnimationFrame((next) => this.loop(next));
    }

    private update(dt: number): void {
        this.updateFlight(dt);
        this.updateEnemyAim(dt);
        this.updateEffects(dt);
        this.updateHpBars(dt);

        if (this.phase === 'impact') {
            this.impactTimer -= dt;
            if (this.impactTimer <= 0) this.afterImpact();
        }
    }

    private updateFlight(dt: number): void {
        if (!this.flight) return;

        this.flight.cursor += dt * POINTS_PER_SECOND;
        const index = Math.floor(this.flight.cursor);

        if (index >= this.flight.points.length - 1) {
            const outcome = this.flight.outcome;
            this.onFlightEnd(outcome);
            return;
        }

        const point = this.flight.points[index];
        this.trail.push({ ...point });
        if (this.trail.length > 14) this.trail.shift();
    }

    private updateEnemyAim(dt: number): void {
        if (this.phase !== 'enemyAiming') return;

        this.enemyAimTimer -= dt;

        if (this.enemyPlan) {
            const progress = clamp(1 - this.enemyAimTimer / ENEMY_AIM_TIME, 0, 1);
            this.barrel.enemy = this.enemyAimFrom + (this.enemyPlan.angle - this.enemyAimFrom) * progress;
        }

        // 等瞄準動畫跑完、而且 AI 也算完解，才真的開火
        if (this.enemyAimTimer <= 0 && this.enemyPlan) {
            const plan = this.enemyPlan;
            this.enemyPlan = null;
            this.shoot(plan);
        }
    }

    private updateEffects(dt: number): void {
        const scale = dt * 60;

        this.particles = this.particles.filter((particle) => {
            particle.x += particle.vx * scale;
            particle.y += particle.vy * scale;
            particle.vy += 0.22 * scale;
            particle.life -= 0.022 * scale;
            return particle.life > 0;
        });

        this.explosions = this.explosions.filter((explosion) => {
            explosion.age += dt;
            return explosion.age < explosion.duration;
        });

        this.floaters = this.floaters.filter((floater) => {
            floater.age += dt;
            return floater.age < floater.duration;
        });

        this.shake = Math.max(0, this.shake - dt * 26);

        for (const side of ['player', 'enemy'] as Side[]) {
            const reaction = this.hitReaction[side];
            if (!reaction) continue;
            reaction.elapsed += dt;
            if (reaction.elapsed >= HIT_REACTION) delete this.hitReaction[side];
        }
    }

    /**
     * Core 的 step() 在開火當下就把傷害結算掉了，但畫面上砲彈還在飛。
     * 血條要等落地才開始扣，否則等於在砲彈命中前就先劇透結果。
     */
    /**
     * 砲台的呈現姿態。中彈後 Core 已經把座標改到震退後的位置，
     * 這裡負責從舊位置演過去：滑行 + 彈跳 + 衰減的晃動，落腳處貼合地形斜度。
     */
    private poseOf(side: Side, state: ArtilleryState): TurretPose {
        const turret = state.turrets[side];
        const reaction = this.hitReaction[side];

        // 砲彈還在飛的時候 Core 早就把震退結算完了，但畫面上還沒打到。
        // 這段期間必須維持開火前的位置，否則一按發射砲台就瞬移。
        let x = this.flight ? this.flight.outcome.knockback[side].from.x : turret.x;
        let lift = 0;

        if (reaction) {
            const progress = clamp(reaction.elapsed / HIT_REACTION, 0, 1);
            const settle = 1 - Math.pow(1 - progress, 3);

            x = lerp(reaction.fromX, turret.x, settle);
            x += Math.sin(progress * Math.PI * 14) * reaction.shake * (1 - progress);
            lift = Math.sin(progress * Math.PI) * reaction.hop;
        }

        const groundY = this.core.groundAt(x);
        return { x, y: groundY - lift, tilt: this.tiltAt(x), groundY };
    }

    /** 用左右兩側的地表高度差算出車體該傾斜多少 */
    private tiltAt(x: number): number {
        const span = 13;
        const slope = this.core.groundAt(x + span) - this.core.groundAt(x - span);
        return clamp(Math.atan2(slope, span * 2), -0.5, 0.5);
    }

    private updateHpBars(dt: number): void {
        if (this.phase === 'flying') return;

        const state = this.core.getState();
        const rate = Math.min(1, dt * 8);
        let changed = false;

        for (const side of ['player', 'enemy'] as Side[]) {
            const target = state.turrets[side].hp;
            const current = this.displayHp[side];
            if (Math.abs(target - current) < 0.4) {
                if (current !== target) {
                    this.displayHp[side] = target;
                    changed = true;
                }
                continue;
            }
            this.displayHp[side] = current + (target - current) * rate;
            changed = true;
        }

        if (changed) this.emitState();
    }

    private render(time: number): void {
        const state = this.viewState();
        this.updatePreview(state);

        this.renderer.render({
            state,
            pose: {
                player: this.poseOf('player', state),
                enemy: this.poseOf('enemy', state),
            },
            stage: this.stage,
            displayHp: this.displayHp,
            barrel: this.barrel,
            power: this.aim.power,
            preview: this.preview,
            projectile: this.flight
                ? { pos: this.flight.points[Math.min(Math.floor(this.flight.cursor), this.flight.points.length - 1)], trail: this.trail }
                : null,
            explosions: this.explosions,
            particles: this.particles,
            floaters: this.floaters,
            drag: this.drag ? { start: this.drag.start, pointer: this.drag.pointer } : null,
            shake: this.shake,
            status: this.statusText(state),
            time,
        });
    }

    private statusText(state: ArtilleryState): string {
        if (state.over) return '';
        if (this.phase === 'enemyAiming') return 'AI 瞄準中…';
        if (this.phase === 'flying') return '';
        if (this.phase === 'impact') return '';
        return '你的回合';
    }

    /**
     * 彈道預覽：只畫前段。用的是跟真正開火同一支 simulate，
     * 所以預覽的線一定貼合實際彈道，只是被截斷。
     */
    private updatePreview(state: ArtilleryState): void {
        // 砲彈在飛、或砲台正在演中彈位移時，Core 的座標跟畫面上的位置還沒對齊，
        // 這時畫預覽線會從錯的地方射出來
        if (!this.canAdjustAim() || this.flight || this.hitReaction.player) {
            this.preview = [];
            this.previewKey = '';
            return;
        }

        const key = `${this.aim.angle.toFixed(1)}:${this.aim.power.toFixed(1)}`;
        if (key === this.previewKey) return;
        this.previewKey = key;

        const shot = this.core.simulate('player', this.aim.angle, this.aim.power);
        const visible = Math.ceil(shot.points.length * 0.35);
        const sampled: Vec2[] = [];
        for (let i = 0; i < visible && sampled.length < 26; i += 4) {
            sampled.push(shot.points[i]);
        }
        this.preview = sampled;
    }

    // === 輸入 ===

    private bindEvents(): void {
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('resize', this.onResize);
    }

    private toLogical(event: PointerEvent): Vec2 {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (FIELD.width / rect.width),
            y: (event.clientY - rect.top) * (FIELD.height / rect.height),
        };
    }

    private handlePointerDown(event: PointerEvent): void {
        if (!this.canAdjustAim()) return;
        event.preventDefault();
        const start = this.toLogical(event);
        this.drag = { start, pointer: start, aimBefore: { ...this.aim } };
    }

    private handlePointerMove(event: PointerEvent): void {
        if (!this.drag) return;
        event.preventDefault();
        this.drag.pointer = this.toLogical(event);
        this.updateAimFromDrag();
    }

    private handlePointerUp(): void {
        if (!this.drag) return;
        const { start, pointer, aimBefore } = this.drag;
        this.drag = null;

        // 沒拉開就放手＝單純點一下畫面，還原瞄準值且不開火。
        // 用實際拖曳距離判斷，不能只看力道 —— 完全沒移動時力道還是上一次的值。
        const dragCssPx = Math.hypot(pointer.x - start.x, pointer.y - start.y) / this.logicalPerCssPixel();
        if (dragCssPx < MIN_DRAG_CSS_PX || this.aim.power < 3) {
            this.setAngle(aimBefore.angle);
            this.setPower(aimBefore.power);
            return;
        }
        this.fire();
    }

    private logicalPerCssPixel(): number {
        return FIELD.width / (this.canvas.clientWidth || FIELD.width);
    }

    /**
     * 拉弓式瞄準：往反方向拉，拉越遠力道越大，放開往反方向射出去。
     * 玩家朝右打，所以要往左下方拉。
     */
    private updateAimFromDrag(): void {
        if (!this.drag) return;
        const { start, pointer } = this.drag;

        const dx = start.x - pointer.x;
        const dy = start.y - pointer.y;
        const distance = Math.hypot(dx, dy);

        this.setAngle((Math.atan2(-dy, dx) * 180) / Math.PI);
        this.setPower((distance / (MAX_DRAG_CSS_PX * this.logicalPerCssPixel())) * AIM.maxPower);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        const target = event.target as HTMLElement | null;
        if (target && ['TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
        if (target instanceof HTMLInputElement && target.type !== 'range') return;
        if (!this.canAdjustAim()) return;

        // 滑桿被點過之後會保有焦點。方向鍵讓給滑桿自己處理（否則會同時動到兩個值），
        // 但空白鍵滑桿不吃，發射必須照常可用
        const onSlider = target instanceof HTMLInputElement;
        const stepSize = event.shiftKey ? 5 : 1;

        switch (event.key) {
            case 'ArrowUp':
                if (onSlider) return;
                event.preventDefault();
                this.setAngle(this.aim.angle + stepSize);
                break;
            case 'ArrowDown':
                if (onSlider) return;
                event.preventDefault();
                this.setAngle(this.aim.angle - stepSize);
                break;
            case 'ArrowRight':
                if (onSlider) return;
                event.preventDefault();
                this.setPower(this.aim.power + stepSize);
                break;
            case 'ArrowLeft':
                if (onSlider) return;
                event.preventDefault();
                this.setPower(this.aim.power - stepSize);
                break;
            case ' ':
                event.preventDefault();
                if (!event.repeat) this.fire();
                break;
            case 'Enter':
                event.preventDefault();
                this.fire();
                break;
        }
    }

    private handleResize(): void {
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => {
            this.renderer.resize();
            this.renderer.buildBackground(this.core.getState());
        }, 150);
    }
}
