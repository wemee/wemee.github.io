import Phaser from 'phaser';
import { COLORS } from '../config';
import type { UnitDef } from '../data/units';
import type { Point, Side } from '../types';

/**
 * 部隊實體：智慧型 sprite。
 * 持有戰鬥狀態欄位（由 GameScene 的主迴圈讀寫），自身只負責視覺呈現：
 * 命中閃白、戰吼加成光環、血條、近戰揮擊的前突手感。
 */
export class Unit {
    readonly side: Side;
    readonly def: UnitDef;
    readonly maxHp: number;

    x: number;
    readonly y: number;
    hp: number;
    /** 攻擊冷卻剩餘（秒） */
    cd = 0;
    /** 戰吼加成剩餘（毫秒，遊戲內時間） */
    rallyMs = 0;

    private dead = false;
    private flashMs = 0;
    private lastHpRatio = 1;
    private lungeUntil = 0;

    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private body: Phaser.GameObjects.Arc;
    private label: Phaser.GameObjects.Text;
    private aura: Phaser.GameObjects.Arc;
    private hpBar: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, side: Side, def: UnitDef, x: number, y: number) {
        this.scene = scene;
        this.side = side;
        this.def = def;
        this.maxHp = def.maxHp;
        this.hp = def.maxHp;
        this.x = x;
        this.y = y;

        const strokeColor = side === 'player' ? COLORS.player : COLORS.enemy;

        // 加成光環（戰吼時亮起）
        this.aura = scene.add.circle(0, 0, def.radius + 5, COLORS.yellow, 0);
        this.aura.setBlendMode(Phaser.BlendModes.ADD);

        this.body = scene.add.circle(0, 0, def.radius, def.color);
        this.body.setStrokeStyle(3, strokeColor, 1);

        this.label = scene.add
            .text(0, 0, def.emoji, { fontFamily: 'sans-serif', fontSize: `${def.radius + 4}px` })
            .setOrigin(0.5);

        this.hpBar = scene.add.graphics();

        this.container = scene.add.container(x, y, [this.aura, this.body, this.label, this.hpBar]);
        this.container.setDepth(10);
        this.drawHpBar(1);
    }

    get position(): Point {
        return { x: this.x, y: this.y };
    }

    get isDead(): boolean {
        return this.dead;
    }

    get isBuffed(): boolean {
        return this.rallyMs > 0;
    }

    setVisible(v: boolean): void {
        this.container.setVisible(v);
    }

    takeDamage(amount: number): void {
        if (this.dead) return;
        this.hp -= amount;
        this.flashMs = 90;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
    }

    heal(amount: number): void {
        if (this.dead) return;
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    /** 近戰揮擊：朝攻擊方向短暫前突，製造打擊手感 */
    lunge(): void {
        this.lungeUntil = this.scene.time.now + 120;
    }

    /** 每幀同步視覺（dtSec 為遊戲內時間步，受變速影響） */
    sync(dtMs: number): void {
        if (this.flashMs > 0) this.flashMs -= dtMs;
        if (this.rallyMs > 0) this.rallyMs -= dtMs;

        // 位置（近戰前突偏移）
        let drawX = this.x;
        if (this.scene.time.now < this.lungeUntil) {
            drawX += this.side === 'player' ? 5 : -5;
        }
        this.container.setPosition(drawX, this.y);

        // 命中閃白
        this.body.setFillStyle(this.flashMs > 0 ? COLORS.white : this.def.color, 1);

        // 戰吼光環
        if (this.rallyMs > 0) {
            const pulse = 0.25 + 0.15 * Math.sin(this.scene.time.now / 90);
            this.aura.setFillStyle(COLORS.yellow, pulse);
        } else {
            this.aura.setFillStyle(COLORS.yellow, 0);
        }

        const ratio = this.hp / this.maxHp;
        if (Math.abs(ratio - this.lastHpRatio) > 0.001) {
            this.drawHpBar(ratio);
            this.lastHpRatio = ratio;
        }
    }

    private drawHpBar(ratio: number): void {
        const w = this.def.radius * 2 + 2;
        const h = 4;
        const x = -w / 2;
        const y = -this.def.radius - 9;
        const g = this.hpBar;
        g.clear();
        g.fillStyle(0x002b36, 0.85);
        g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle(COLORS.red, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(ratio > 0.4 ? COLORS.green : COLORS.orange, 1);
        g.fillRect(x, y, w * Math.max(0, ratio), h);
    }

    destroy(): void {
        this.container.destroy();
    }
}
