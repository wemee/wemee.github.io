import Phaser from 'phaser';
import { COLORS } from '../config';
import type { UnitType, Point, Side } from '../types';
import type { Unit } from './Unit';
import type { Keep } from './Keep';

export type ProjectileKind = 'arrow' | 'orb' | 'bolt';

export interface ProjectileOptions {
    target: Unit | null; // 追蹤的目標單位（可能中途死亡）
    point?: Point; // 無單位目標時的固定落點（如攻打主堡）
    keep?: Keep; // 明確指定攻打的主堡（優先於單位目標）
    speed: number;
    color: number;
    kind: ProjectileKind;
    damage: number;
    aoeRadius: number; // 0 = 單體
    attackerType?: UnitType; // 用於命中時計算相剋
}

/**
 * 投射物：弓箭、法球、主堡防禦箭。
 * 追蹤目標單位的即時位置；目標死亡則飛向最後已知位置。命中解算由 GameScene 處理。
 */
export class Projectile {
    readonly side: Side;
    readonly damage: number;
    readonly aoeRadius: number;
    readonly attackerType?: UnitType;

    /** 明確指定攻打的主堡（命中時優先結算） */
    readonly keepTarget: Keep | null;

    private scene: Phaser.Scene;
    private x: number;
    private y: number;
    private target: Unit | null;
    private point: Point | null;
    private speed: number;
    private done = false;
    private impact: Point;
    private gfx: Phaser.GameObjects.GameObject & {
        setPosition: (x: number, y: number) => unknown;
        setRotation?: (r: number) => unknown;
    };
    private glow?: Phaser.GameObjects.Arc;

    constructor(scene: Phaser.Scene, side: Side, from: Point, opts: ProjectileOptions) {
        this.scene = scene;
        this.side = side;
        this.x = from.x;
        this.y = from.y;
        this.target = opts.target;
        this.point = opts.point ?? null;
        this.keepTarget = opts.keep ?? null;
        this.speed = opts.speed;
        this.damage = opts.damage;
        this.aoeRadius = opts.aoeRadius;
        this.attackerType = opts.attackerType;
        this.impact = { x: from.x, y: from.y };

        if (opts.kind === 'orb') {
            this.glow = scene.add.circle(from.x, from.y, 11, opts.color, 0.35).setDepth(14);
            this.glow.setBlendMode(Phaser.BlendModes.ADD);
            const core = scene.add.circle(from.x, from.y, 5, COLORS.white, 0.95).setDepth(15);
            this.gfx = core;
        } else if (opts.kind === 'arrow') {
            const arrow = scene.add.rectangle(from.x, from.y, 16, 3, opts.color).setDepth(14);
            this.gfx = arrow;
        } else {
            this.gfx = scene.add.circle(from.x, from.y, 4, opts.color).setDepth(14);
        }
    }

    get isDone(): boolean {
        return this.done;
    }

    get impactPoint(): Point {
        return this.impact;
    }

    /** 目標單位（若仍存活），供單體命中使用 */
    get targetUnit(): Unit | null {
        return this.target && !this.target.isDead ? this.target : null;
    }

    update(dtSec: number): void {
        if (this.done) return;

        const dest = this.target && !this.target.isDead ? this.target.position : this.point ?? this.impact;
        const dx = dest.x - this.x;
        const dy = dest.y - this.y;
        const dist = Math.hypot(dx, dy);
        const step = this.speed * dtSec;

        if (dist <= step || dist < 1) {
            this.x = dest.x;
            this.y = dest.y;
            this.impact = { x: dest.x, y: dest.y };
            this.done = true;
        } else {
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
            if (this.gfx.setRotation) this.gfx.setRotation(Math.atan2(dy, dx));
        }

        this.gfx.setPosition(this.x, this.y);
        this.glow?.setPosition(this.x, this.y);
    }

    destroy(): void {
        this.gfx.destroy();
        this.glow?.destroy();
    }
}
