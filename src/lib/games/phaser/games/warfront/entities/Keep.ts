import Phaser from 'phaser';
import { COLORS, GROUND_Y } from '../config';
import type { Point, Side } from '../types';

/**
 * 主堡實體：以 Graphics 繪製的城堡，顯示血條，受擊閃光。
 * 等級越高越雄偉（增高、加旗）。防禦箭的開火邏輯在 GameScene。
 */
export class Keep {
    readonly side: Side;
    readonly x: number;
    hp: number;
    maxHp: number;
    level = 0;

    private scene: Phaser.Scene;
    private gfx: Phaser.GameObjects.Graphics;
    private hpBar: Phaser.GameObjects.Graphics;
    private flash: Phaser.GameObjects.Rectangle;
    private width = 70;

    constructor(scene: Phaser.Scene, side: Side, x: number, maxHp: number) {
        this.scene = scene;
        this.side = side;
        this.x = x;
        this.maxHp = maxHp;
        this.hp = maxHp;

        this.gfx = scene.add.graphics();
        this.gfx.setDepth(6);
        this.hpBar = scene.add.graphics();
        this.hpBar.setDepth(20);

        this.flash = scene.add
            .rectangle(x, GROUND_Y - 60, this.width + 12, 140, COLORS.white, 0)
            .setDepth(7)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.redraw();
    }

    /** 砲口/防禦箭發射點與目標瞄準點 */
    get center(): Point {
        return { x: this.x, y: GROUND_Y - 60 };
    }

    get isDestroyed(): boolean {
        return this.hp <= 0;
    }

    takeDamage(amount: number): void {
        if (this.hp <= 0) return;
        this.hp = Math.max(0, this.hp - amount);
        this.flash.setAlpha(0.6);
        this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 160 });
        this.redraw();
    }

    upgrade(addHp: number): void {
        this.level++;
        this.maxHp += addHp;
        this.hp += addHp;
        this.redraw();
    }

    private redraw(): void {
        const g = this.gfx;
        g.clear();

        const main = this.side === 'player' ? COLORS.player : COLORS.enemy;
        const dark = this.side === 'player' ? 0x0c3a52 : 0x521413;
        const h = Math.min(150, 96 + this.level * 9);
        const w = this.width;
        const left = this.x - w / 2;
        const top = GROUND_Y - h;

        // 地基光暈
        g.fillStyle(main, 0.12);
        g.fillEllipse(this.x, GROUND_Y + 4, w + 30, 22);

        // 城牆主體
        g.fillStyle(dark, 1);
        g.fillRect(left, top, w, h);
        g.fillStyle(main, 0.9);
        g.fillRect(left, top, w, 10); // 頂帶
        g.lineStyle(2, main, 0.8);
        g.strokeRect(left, top, w, h);

        // 城垛
        const merlon = 10;
        g.fillStyle(main, 0.9);
        for (let mx = left; mx + merlon <= left + w; mx += merlon * 2) {
            g.fillRect(mx, top - 8, merlon, 8);
        }

        // 中央塔樓
        const towerW = 22;
        const towerH = 26;
        g.fillStyle(dark, 1);
        g.fillRect(this.x - towerW / 2, top - towerH, towerW, towerH);
        g.lineStyle(2, main, 0.8);
        g.strokeRect(this.x - towerW / 2, top - towerH, towerW, towerH);

        // 旗桿與旗幟（朝戰場方向）
        const flagDir = this.side === 'player' ? 1 : -1;
        const poleTop = top - towerH - 26;
        g.lineStyle(2, COLORS.text, 0.7);
        g.lineBetween(this.x, top - towerH, this.x, poleTop);
        g.fillStyle(main, 1);
        g.beginPath();
        g.moveTo(this.x, poleTop);
        g.lineTo(this.x + flagDir * 22, poleTop + 7);
        g.lineTo(this.x, poleTop + 14);
        g.closePath();
        g.fillPath();

        // 門
        g.fillStyle(0x002b36, 0.9);
        g.fillRect(this.x - 9, GROUND_Y - 26, 18, 26);

        this.drawHpBar();
    }

    private drawHpBar(): void {
        const w = 88;
        const h = 7;
        const x = this.x - w / 2;
        const y = GROUND_Y - Math.min(150, 96 + this.level * 9) - 28;
        const ratio = Math.max(0, this.hp / this.maxHp);
        const g = this.hpBar;
        g.clear();
        g.fillStyle(0x002b36, 0.9);
        g.fillRect(x - 2, y - 2, w + 4, h + 4);
        g.fillStyle(COLORS.red, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(ratio > 0.35 ? COLORS.green : COLORS.orange, 1);
        g.fillRect(x, y, w * ratio, h);
    }

    destroy(): void {
        this.gfx.destroy();
        this.hpBar.destroy();
        this.flash.destroy();
    }
}
