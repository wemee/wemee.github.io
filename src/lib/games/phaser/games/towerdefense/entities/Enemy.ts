import Phaser from 'phaser';
import { COLORS } from '../config';
import { positionAtDistance } from '../systems/path';
import type { EnemyDef } from '../data/enemies';
import type { Point } from '../types';

/**
 * 敵人實體：沿預烤路徑前進、顯示血條、可受擊與被緩速。
 */
export class Enemy {
    readonly def: EnemyDef;
    readonly maxHp: number;
    readonly reward: number;
    hp: number;
    private distance = 0;
    private slowFactor = 1; // 1 = 正常速度
    private slowRemainingMs = 0;

    private dead = false;
    private leaked = false;
    private flashMs = 0;

    private scene: Phaser.Scene;
    private waypoints: Point[];
    private container: Phaser.GameObjects.Container;
    private body: Phaser.GameObjects.Arc;
    private hpBar: Phaser.GameObjects.Graphics;
    private lastHpRatio = 1;

    constructor(
        scene: Phaser.Scene,
        def: EnemyDef,
        waypoints: Point[],
        startDistance = 0,
        hpMultiplier = 1,
        rewardMultiplier = 1,
    ) {
        this.scene = scene;
        this.def = def;
        this.maxHp = Math.round(def.maxHp * hpMultiplier);
        this.reward = Math.round(def.reward * rewardMultiplier);
        this.hp = this.maxHp;
        this.waypoints = waypoints;
        this.distance = startDistance;

        const start = positionAtDistance(waypoints, startDistance).point;
        this.body = scene.add.circle(0, 0, def.radius, def.color);
        this.body.setStrokeStyle(2, 0x002b36, 0.6);
        this.hpBar = scene.add.graphics();
        this.container = scene.add.container(start.x, start.y, [this.body, this.hpBar]);
        this.container.setDepth(10);
        this.drawHpBar(1);
    }

    getDistance(): number {
        return this.distance;
    }

    /** 推進一個時間步（秒）。speedMul 為全域變速倍率。 */
    update(dtSec: number): void {
        if (this.slowRemainingMs > 0) {
            this.slowRemainingMs -= dtSec * 1000;
            if (this.slowRemainingMs <= 0) this.slowFactor = 1;
        }
        const speed = this.def.speed * this.slowFactor;
        this.distance += speed * dtSec;

        const { point, reachedEnd } = positionAtDistance(this.waypoints, this.distance);
        this.container.setPosition(point.x, point.y);
        if (reachedEnd) this.leaked = true;

        const ratio = Math.max(0, this.hp / this.maxHp);
        if (ratio !== this.lastHpRatio) {
            this.drawHpBar(ratio);
            this.lastHpRatio = ratio;
        }

        // 命中閃白
        if (this.flashMs > 0) {
            this.flashMs -= dtSec * 1000;
            this.body.setFillStyle(0xffffff, 1);
        } else {
            this.body.setFillStyle(this.def.color, 1);
        }
        // 緩速時染上一層藍
        this.body.setStrokeStyle(2, this.slowFactor < 1 ? COLORS.blue : 0x002b36, this.slowFactor < 1 ? 1 : 0.6);
    }

    takeDamage(amount: number): void {
        if (this.dead) return;
        this.hp -= amount;
        this.flashMs = 80;
        if (this.hp <= 0) this.dead = true;
    }

    /** 套用緩速：factor < 1（取最強），持續 durationMs */
    applySlow(factor: number, durationMs: number): void {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowRemainingMs = Math.max(this.slowRemainingMs, durationMs);
    }

    getPosition(): Point {
        return { x: this.container.x, y: this.container.y };
    }

    get isDead(): boolean {
        return this.dead;
    }

    get isLeaked(): boolean {
        return this.leaked;
    }

    private drawHpBar(ratio: number): void {
        const w = this.def.radius * 2;
        const h = 4;
        const x = -w / 2;
        const y = -this.def.radius - 8;
        const g = this.hpBar;
        g.clear();
        g.fillStyle(0x002b36, 0.8);
        g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle(COLORS.red, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(COLORS.green, 1);
        g.fillRect(x, y, w * ratio, h);
    }

    destroy(): void {
        this.container.destroy();
    }
}
