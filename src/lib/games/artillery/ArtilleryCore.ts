/**
 * 《彈道對決》遊戲核心 — 純邏輯，不碰 DOM / Canvas。
 *
 * 回合制語意：一次 step() = 打完一整發砲彈。
 * 彈道模擬 simulate() 是唯一的物理來源，開火、彈道預覽、AI 搜尋三邊共用，
 * 避免預覽畫的線跟真正打出去的軌跡對不上。
 */

import { GameCore, type GameCoreConfig, type StepResult } from '@/lib/games/core/GameCore';
import { AIM, COMBAT, FIELD, PHYSICS, TERRAIN, TURRET } from './config';
import { flattenPad, generateTerrain, groundYAt } from './terrain';
import { clamp, mulberry32, type Rng } from './random';
import type { ArtilleryState, ShotAction, ShotOutcome, ShotResult, Side, Turret, Vec2 } from './types';

const DEG_TO_RAD = Math.PI / 180;
const SIDES: Side[] = ['player', 'enemy'];

export interface ArtilleryCoreConfig extends GameCoreConfig {
    width?: number;
    height?: number;
}

export class ArtilleryCore extends GameCore<ArtilleryState, ShotAction> {
    private readonly width: number;
    private readonly height: number;
    private seed: number;
    private rng: Rng;

    private groundYs: number[] = [];
    private turrets!: Record<Side, Turret>;
    private turn: Side = 'player';
    private round = 1;
    private over = false;
    private winner: Side | 'draw' | null = null;
    private lastShot: ShotOutcome | null = null;

    constructor(config: ArtilleryCoreConfig = {}) {
        super(config);
        this.width = config.width ?? FIELD.width;
        this.height = config.height ?? FIELD.height;
        this.seed = config.seed ?? Math.floor(Math.random() * 0xffffffff);
        this.rng = mulberry32(this.seed);
        this.reset();
    }

    setSeed(seed: number): void {
        this.seed = seed;
        this.rng = mulberry32(seed);
    }

    /** 取得這一局的地形種子，讓渲染層能產生對應的遠景山脈 */
    getSeed(): number {
        return this.seed;
    }

    reset(): ArtilleryState {
        this.currentStep = 0;
        this.round = 1;
        this.turn = 'player';
        this.over = false;
        this.winner = null;
        this.lastShot = null;

        this.groundYs = generateTerrain(this.rng, { height: this.height });

        const jitter = (base: number) =>
            (base + (this.rng() - 0.5) * 2 * TERRAIN.xJitterRatio) * this.width;
        const playerX = jitter(TERRAIN.playerXRatio);
        const enemyX = jitter(TERRAIN.enemyXRatio);

        this.turrets = {
            player: this.createTurret('player', playerX),
            enemy: this.createTurret('enemy', enemyX),
        };

        return this.getState();
    }

    private createTurret(side: Side, x: number): Turret {
        const y = flattenPad(this.groundYs, this.width, x);
        return {
            side,
            x,
            y,
            hp: COMBAT.maxHp,
            angle: 45,
            power: 60,
        };
    }

    /**
     * 開火一發：模擬彈道、結算傷害、換手。
     * 動畫播放由上層負責，Core 這裡是瞬間完成的。
     */
    step(action: ShotAction): StepResult<ArtilleryState> {
        if (this.over) {
            return { observation: this.getState(), reward: 0, terminated: true, truncated: false };
        }

        const shooter = this.turn;
        const angle = clamp(action.angle, AIM.minAngle, AIM.maxAngle);
        const power = clamp(action.power, AIM.minPower, AIM.maxPower);

        this.turrets[shooter].angle = angle;
        this.turrets[shooter].power = power;

        const shot = this.simulate(shooter, angle, power);
        const damage = this.applyDamage(shot);

        this.lastShot = { ...shot, shooter, angle, power, damage };
        this.currentStep += 1;

        const opponent: Side = shooter === 'player' ? 'enemy' : 'player';
        const shooterDead = this.turrets[shooter].hp <= 0;
        const opponentDead = this.turrets[opponent].hp <= 0;

        if (shooterDead || opponentDead) {
            this.over = true;
            this.winner = shooterDead && opponentDead ? 'draw' : shooterDead ? opponent : shooter;
        } else {
            this.turn = opponent;
            if (opponent === 'player') this.round += 1;
        }

        return {
            observation: this.getState(),
            reward: damage[opponent] - damage[shooter],
            terminated: this.over,
            truncated: shot.flightTime >= PHYSICS.maxFlightTime,
            info: { shooter, damage },
        };
    }

    getState(): ArtilleryState {
        return {
            width: this.width,
            height: this.height,
            seed: this.seed,
            groundYs: this.groundYs,
            turrets: {
                player: { ...this.turrets.player },
                enemy: { ...this.turrets.enemy },
            },
            turn: this.turn,
            round: this.round,
            over: this.over,
            winner: this.winner,
            lastShot: this.lastShot,
        };
    }

    /** 砲管旋轉軸位置 */
    pivotOf(side: Side): Vec2 {
        const turret = this.turrets[side];
        return { x: turret.x, y: turret.y - TURRET.pivotOffset };
    }

    /** 車體中心，命中判定與爆炸距離都以此為準 */
    centerOf(side: Side): Vec2 {
        const turret = this.turrets[side];
        return { x: turret.x, y: turret.y - TURRET.centerOffset };
    }

    /** 砲口位置（砲彈出膛點） */
    muzzleOf(side: Side, angle: number): Vec2 {
        const pivot = this.pivotOf(side);
        const direction = this.facingOf(side);
        const radians = clamp(angle, AIM.minAngle, AIM.maxAngle) * DEG_TO_RAD;
        return {
            x: pivot.x + direction * Math.cos(radians) * TURRET.barrelLength,
            y: pivot.y - Math.sin(radians) * TURRET.barrelLength,
        };
    }

    /** 面向：玩家往右打（+1），敵方往左打（-1） */
    facingOf(side: Side): 1 | -1 {
        return side === 'player' ? 1 : -1;
    }

    groundAt(x: number): number {
        return groundYAt(this.groundYs, this.width, x);
    }

    /** 力道（0-100）換算初速 px/s */
    static speedOf(power: number): number {
        const t = clamp(power, AIM.minPower, AIM.maxPower) / AIM.maxPower;
        return PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * t;
    }

    /**
     * 彈道模擬。純函式，不動狀態，可安全給 AI 大量呼叫。
     * @param record 是否記錄彈道點；AI 掃描時關掉可省下大量陣列配置
     */
    simulate(side: Side, angle: number, power: number, record = true): ShotResult {
        const radians = clamp(angle, AIM.minAngle, AIM.maxAngle) * DEG_TO_RAD;
        const speed = ArtilleryCore.speedOf(power);
        const direction = this.facingOf(side);

        let vx = direction * speed * Math.cos(radians);
        let vy = -speed * Math.sin(radians);

        const start = this.muzzleOf(side, angle);
        let x = start.x;
        let y = start.y;

        const points: Vec2[] = record ? [{ x, y }] : [];
        const opponent: Side = side === 'player' ? 'enemy' : 'player';
        const targets: Side[] = [opponent, side];

        const { dt, gravity, recordEvery, maxFlightTime } = PHYSICS;
        const maxSteps = Math.ceil(maxFlightTime / dt);

        for (let stepIndex = 1; stepIndex <= maxSteps; stepIndex++) {
            const previousX = x;
            const previousY = y;

            vy += gravity * dt;
            x += vx * dt;
            y += vy * dt;

            const time = stepIndex * dt;

            // 砲台命中（先判定，砲彈打在車體上不該算地形）
            for (const target of targets) {
                const center = this.centerOf(target);
                if (Math.hypot(x - center.x, y - center.y) <= TURRET.radius) {
                    if (record) points.push({ x, y });
                    return { points, impact: { x, y }, hitTurret: target, outOfBounds: false, flightTime: time };
                }
            }

            // 地形命中：在前後兩點之間二分逼近，落點才會貼著地表
            if (y >= this.groundAt(x)) {
                const impact = this.refineGroundImpact(previousX, previousY, x, y);
                if (record) points.push(impact);
                return { points, impact, hitTurret: null, outOfBounds: false, flightTime: time };
            }

            // 飛出左右邊界就算脫靶（往上飛出去不算，讓它掉回來）
            if (x < -TURRET.radius || x > this.width + TURRET.radius) {
                if (record) points.push({ x, y });
                return { points, impact: null, hitTurret: null, outOfBounds: true, flightTime: time };
            }

            if (record && stepIndex % recordEvery === 0) {
                points.push({ x, y });
            }
        }

        return { points, impact: null, hitTurret: null, outOfBounds: true, flightTime: maxFlightTime };
    }

    private refineGroundImpact(x0: number, y0: number, x1: number, y1: number): Vec2 {
        let lowT = 0;
        let highT = 1;
        for (let i = 0; i < 8; i++) {
            const midT = (lowT + highT) / 2;
            const midX = x0 + (x1 - x0) * midT;
            const midY = y0 + (y1 - y0) * midT;
            if (midY >= this.groundAt(midX)) {
                highT = midT;
            } else {
                lowT = midT;
            }
        }
        const t = highT;
        return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }

    /** 依落點結算雙方傷害（自傷同樣成立） */
    private applyDamage(shot: ShotResult): Record<Side, number> {
        const damage: Record<Side, number> = { player: 0, enemy: 0 };
        if (!shot.impact) return damage;

        for (const side of SIDES) {
            damage[side] = ArtilleryCore.damageAt(shot.impact, this.centerOf(side), shot.hitTurret === side);
            if (damage[side] > 0) {
                this.turrets[side].hp = Math.max(0, this.turrets[side].hp - damage[side]);
            }
        }
        return damage;
    }

    /** 傷害公式：直接命中固定值，其餘依爆炸距離線性衰減 */
    static damageAt(impact: Vec2, center: Vec2, directHit: boolean): number {
        if (directHit) return COMBAT.directDamage;
        const distance = Math.hypot(impact.x - center.x, impact.y - center.y);
        if (distance >= COMBAT.blastRadius) return 0;
        return Math.round(COMBAT.blastMax * (1 - distance / COMBAT.blastRadius));
    }
}
