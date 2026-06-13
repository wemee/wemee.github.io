import Phaser from 'phaser';
import { COLORS } from '../config';

/**
 * 戰場演出（光影 / 打擊感）。
 * 皆為純視覺、以真實時間播放的 tween，不影響遊戲邏輯。
 */

/** 命中火花：小點四散 + 一圈快閃 */
export function hitSpark(scene: Phaser.Scene, x: number, y: number, color: number): void {
    const flash = scene.add.circle(x, y, 9, COLORS.white, 0.9).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 130, onComplete: () => flash.destroy() });
    for (let i = 0; i < 4; i++) {
        const dot = scene.add.circle(x, y, Phaser.Math.Between(1, 3), color).setDepth(25);
        const ang = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(8, 20);
        scene.tweens.add({
            targets: dot,
            x: x + Math.cos(ang) * dist,
            y: y + Math.sin(ang) * dist,
            alpha: 0,
            duration: 220,
            ease: 'Quad.easeOut',
            onComplete: () => dot.destroy(),
        });
    }
}

/** 近戰揮擊弧光 */
export function slash(scene: Phaser.Scene, x: number, y: number, dir: number, color: number): void {
    const arc = scene.add
        .arc(x + dir * 12, y, 18, -55, 55, false)
        .setStrokeStyle(3, color, 0.9)
        .setDepth(24)
        .setBlendMode(Phaser.BlendModes.ADD);
    arc.setRotation(dir > 0 ? 0 : Math.PI);
    scene.tweens.add({
        targets: arc,
        scaleX: 1.4,
        scaleY: 1.4,
        alpha: 0,
        duration: 160,
        onComplete: () => arc.destroy(),
    });
}

/** 死亡爆裂 */
export function deathBurst(scene: Phaser.Scene, x: number, y: number, color: number): void {
    const ring = scene.add.circle(x, y, 6, color, 0).setStrokeStyle(2, color, 0.8).setDepth(24);
    scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 280, onComplete: () => ring.destroy() });
    for (let i = 0; i < 8; i++) {
        const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 4), color).setDepth(24);
        const ang = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(12, 34);
        scene.tweens.add({
            targets: dot,
            x: x + Math.cos(ang) * dist,
            y: y + Math.sin(ang) * dist,
            alpha: 0,
            duration: 360,
            ease: 'Quad.easeOut',
            onComplete: () => dot.destroy(),
        });
    }
}

/** 範圍衝擊環（法師 AoE） */
export function aoeRing(scene: Phaser.Scene, x: number, y: number, radius: number, color: number): void {
    const ring = scene.add.circle(x, y, radius, color, 0.18).setStrokeStyle(3, color, 0.9).setDepth(23);
    ring.setScale(0.25);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
}

/** 治療脈動 */
export function healPulse(scene: Phaser.Scene, x: number, y: number, radius: number): void {
    const ring = scene.add.circle(x, y, radius, COLORS.green, 0.12).setStrokeStyle(2, COLORS.green, 0.7).setDepth(22);
    ring.setScale(0.3);
    scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
}

/** 受治療單位上的綠色十字 */
export function healMark(scene: Phaser.Scene, x: number, y: number): void {
    const mark = scene.add
        .text(x, y - 18, '＋', { fontFamily: 'sans-serif', fontSize: '16px', color: '#859900', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(26);
    scene.tweens.add({ targets: mark, y: y - 34, alpha: 0, duration: 600, onComplete: () => mark.destroy() });
}

/** 隕石落地：滿屏白閃 + 火光環 + 碎屑 + 震屏 */
export function meteorImpact(scene: Phaser.Scene, x: number, y: number, radius: number): void {
    scene.cameras.main.shake(260, 0.012);

    const flash = scene.add
        .circle(x, y, radius * 1.1, COLORS.white, 0.85)
        .setDepth(27)
        .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 260, onComplete: () => flash.destroy() });

    aoeRing(scene, x, y, radius, COLORS.orange);
    const ring2 = scene.add.circle(x, y, radius, COLORS.yellow, 0).setStrokeStyle(4, COLORS.yellow, 0.9).setDepth(26);
    ring2.setScale(0.2);
    scene.tweens.add({ targets: ring2, scale: 1.2, alpha: 0, duration: 420, onComplete: () => ring2.destroy() });

    // 焦痕
    const scorch = scene.add.ellipse(x, y, radius * 1.6, radius * 0.5, 0x1a0e08, 0.5).setDepth(2);
    scene.tweens.add({ targets: scorch, alpha: 0, duration: 2200, onComplete: () => scorch.destroy() });

    for (let i = 0; i < 16; i++) {
        const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 5), Phaser.Math.RND.pick([COLORS.orange, COLORS.yellow, COLORS.red])).setDepth(26);
        const ang = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(30, radius + 30);
        scene.tweens.add({
            targets: dot,
            x: x + Math.cos(ang) * dist,
            y: y + Math.sin(ang) * dist * 0.6,
            alpha: 0,
            duration: Phaser.Math.Between(380, 620),
            ease: 'Quad.easeOut',
            onComplete: () => dot.destroy(),
        });
    }
}

/** 隕石落點預警（每幀重畫；progress 0→1） */
export function drawTelegraph(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, progress: number): void {
    const p = Phaser.Math.Clamp(progress, 0, 1);
    g.fillStyle(COLORS.red, 0.12);
    g.fillCircle(x, y, radius);
    g.lineStyle(2, COLORS.red, 0.8);
    g.strokeCircle(x, y, radius);
    // 收縮的內圈表示倒數
    g.lineStyle(3, COLORS.yellow, 0.9);
    g.strokeCircle(x, y, radius * (1 - p));
}

/** 置中橫幅 */
export function banner(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    text: string,
    colorHex: string,
    hold = 700,
    size = 42,
): void {
    const t = scene.add
        .text(cx, cy, text, { fontFamily: 'sans-serif', fontSize: `${size}px`, color: colorHex, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(30)
        .setAlpha(0);
    t.setStroke('#002b36', 6);
    scene.tweens.add({
        targets: t,
        alpha: 1,
        scale: { from: 0.75, to: 1.08 },
        duration: 240,
        yoyo: true,
        hold,
        onComplete: () => t.destroy(),
    });
}
