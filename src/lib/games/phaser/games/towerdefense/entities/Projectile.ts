import Phaser from 'phaser';
import type { Enemy } from './Enemy';
import type { Point } from '../types';

export interface ProjectileEffect {
    damage: number;
    splash: number; // 0 = 單體
    slow?: { factor: number; durationMs: number };
}

/**
 * 子彈：朝目標敵人追蹤飛行；命中由 GameScene 解算（傷害/濺射/緩速）。
 */
export class Projectile {
    readonly effect: ProjectileEffect;
    private gfx: Phaser.GameObjects.Arc;
    private pos: Point;
    private target: Enemy | null;
    private lastTargetPos: Point;
    private speed: number;
    private done = false;

    constructor(
        scene: Phaser.Scene,
        from: Point,
        target: Enemy,
        speed: number,
        color: number,
        effect: ProjectileEffect,
    ) {
        this.pos = { x: from.x, y: from.y };
        this.target = target;
        this.lastTargetPos = target.getPosition();
        this.speed = speed;
        this.effect = effect;
        this.gfx = scene.add.circle(from.x, from.y, effect.splash > 0 ? 5 : 3.5, color);
        this.gfx.setDepth(20);
    }

    update(dtSec: number): void {
        const aim = this.target && !this.target.isDead ? this.target.getPosition() : this.lastTargetPos;
        this.lastTargetPos = aim;

        const dx = aim.x - this.pos.x;
        const dy = aim.y - this.pos.y;
        const dist = Math.hypot(dx, dy);
        const step = this.speed * dtSec;

        if (dist <= step + 4) {
            this.pos = { x: aim.x, y: aim.y };
            this.done = true;
        } else {
            this.pos = { x: this.pos.x + (dx / dist) * step, y: this.pos.y + (dy / dist) * step };
        }
        this.gfx.setPosition(this.pos.x, this.pos.y);
    }

    get isDone(): boolean {
        return this.done;
    }

    get impactPoint(): Point {
        return this.pos;
    }

    get targetEnemy(): Enemy | null {
        return this.target;
    }

    destroy(): void {
        this.gfx.destroy();
    }
}
