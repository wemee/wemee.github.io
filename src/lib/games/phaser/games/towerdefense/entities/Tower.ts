import Phaser from 'phaser';
import { GRID, COLORS } from '../config';
import type { TowerDef, TowerTier } from '../data/towers';
import type { Enemy } from './Enemy';
import type { ProjectileEffect } from './Projectile';
import type { GridPos, Point } from '../types';

/**
 * 塔實體：選目標、轉向、依射速開火。傷害解算交由 GameScene。
 */
export class Tower {
    readonly def: TowerDef;
    readonly gridPos: GridPos;
    readonly center: Point;
    level = 1;

    private fireTimer = 0;
    private container: Phaser.GameObjects.Container;
    private turret: Phaser.GameObjects.Arc;
    private barrel: Phaser.GameObjects.Graphics;
    private pips: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, def: TowerDef, gridPos: GridPos, center: Point) {
        this.def = def;
        this.gridPos = gridPos;
        this.center = center;

        const ts = GRID.tileSize;
        const base = scene.add.rectangle(0, 0, ts - 8, ts - 8, 0x0d3b44);
        base.setStrokeStyle(2, def.color, 0.9);

        this.barrel = scene.add.graphics();
        this.barrel.lineStyle(5, Phaser.Display.Color.IntegerToColor(def.color).darken(30).color, 1);
        this.barrel.lineBetween(0, 0, ts * 0.42, 0);

        this.turret = scene.add.circle(0, 0, ts * 0.26, def.color);
        this.turret.setStrokeStyle(2, COLORS.background, 0.7);

        this.pips = scene.add.graphics();

        this.container = scene.add.container(center.x, center.y, [base, this.barrel, this.turret, this.pips]);
        this.container.setDepth(15);
        this.drawPips();
    }

    get tier(): TowerTier {
        return this.def.tiers[this.level - 1];
    }

    get maxLevel(): number {
        return this.def.tiers.length;
    }

    canUpgrade(): boolean {
        return this.level < this.maxLevel;
    }

    /** 下一階成本（已滿級回傳 null） */
    get upgradeCost(): number | null {
        return this.canUpgrade() ? this.def.tiers[this.level].cost : null;
    }

    upgrade(): void {
        if (!this.canUpgrade()) return;
        this.level++;
        this.drawPips();
    }

    update(dtSec: number, enemies: Enemy[], fire: (target: Enemy, effect: ProjectileEffect) => void): void {
        this.fireTimer += dtSec * 1000;
        const target = this.acquireTarget(enemies);
        if (target) {
            const p = target.getPosition();
            this.barrel.setRotation(Math.atan2(p.y - this.center.y, p.x - this.center.x));
        }
        if (target && this.fireTimer >= this.tier.fireRateMs) {
            this.fireTimer = 0;
            const t = this.tier;
            fire(target, { damage: t.damage, splash: t.splash ?? 0, slow: t.slow });
        }
    }

    /** 選擇射程內最接近終點（行進距離最大）的敵人 */
    private acquireTarget(enemies: Enemy[]): Enemy | null {
        const range = this.tier.range;
        let best: Enemy | null = null;
        let bestDist = -1;
        for (const e of enemies) {
            if (e.isDead) continue;
            const p = e.getPosition();
            if (Math.hypot(p.x - this.center.x, p.y - this.center.y) > range) continue;
            const d = e.getDistance();
            if (d > bestDist) {
                bestDist = d;
                best = e;
            }
        }
        return best;
    }

    private drawPips(): void {
        const g = this.pips;
        g.clear();
        const r = 2.5;
        const gap = 8;
        const startX = -((this.maxLevel - 1) * gap) / 2;
        const y = GRID.tileSize * 0.3;
        for (let i = 0; i < this.maxLevel; i++) {
            g.fillStyle(i < this.level ? COLORS.text : 0x0a4f5c, 1);
            g.fillCircle(startX + i * gap, y, r);
        }
    }

    destroy(): void {
        this.container.destroy();
    }
}
