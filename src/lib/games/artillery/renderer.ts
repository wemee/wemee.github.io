/**
 * 《彈道對決》渲染層 — 只負責畫，不含任何遊戲規則。
 *
 * 視覺方向：黃昏戰場。暖色地平線光暈打在冷色 Solarized 地形上，
 * 三層視差山脈拉出景深，雙方砲台用藍／橘區分陣營。
 * 背景（天空、遠山、地形）整局不變，先畫進離屏 canvas，每幀直接貼上。
 */

import type { Particle } from '@/lib/games/types';
import { drawParticles } from '@/lib/games/GameUtils';
import { COMBAT, FIELD, TURRET } from './config';
import { generateTerrain } from './terrain';
import { mulberry32 } from './random';
import type { ArtilleryState, Side, TurretPose, Vec2 } from './types';

const COLORS = {
    skyTop: '#00161d',
    skyMid: '#002b36',
    glow: 'rgba(203, 75, 22, 0.55)',
    sun: '#b58900',
    farHill: '#03303c',
    nearHill: '#053f4c',
    terrainTop: '#0a4b59',
    terrainBottom: '#01181f',
    rim: '#859900',
    player: '#268bd2',
    playerDark: '#1a5f92',
    enemy: '#cb4b16',
    enemyDark: '#8f350f',
    shell: '#fdf6e3',
    text: '#93a1a1',
    textBright: '#fdf6e3',
} as const;

export interface Explosion {
    x: number;
    y: number;
    age: number;
    duration: number;
    radius: number;
}

export interface Floater {
    x: number;
    y: number;
    text: string;
    color: string;
    age: number;
    duration: number;
}

export interface ArtilleryView {
    state: ArtilleryState;
    /** 砲台的呈現姿態（含中彈的位移彈跳與地形傾斜），由上層算好 */
    pose: Record<Side, TurretPose>;
    /** 目前關卡 */
    stage: number;
    /** 動畫中的血量，會平滑追上 state 的實際血量 */
    displayHp: Record<Side, number>;
    /** 目前砲管仰角（玩家跟著輸入走，AI 瞄準時會轉動） */
    barrel: Record<Side, number>;
    /** 玩家目前的力道，用於力道環與讀數 */
    power: number;
    /** 彈道預覽點（只畫前段） */
    preview: Vec2[];
    projectile: { pos: Vec2; trail: Vec2[] } | null;
    explosions: Explosion[];
    particles: Particle[];
    floaters: Floater[];
    /** 拖曳的起點與目前指標位置 */
    drag: { start: Vec2; pointer: Vec2 } | null;
    shake: number;
    status: string;
    time: number;
}

export class ArtilleryRenderer {
    private readonly ctx: CanvasRenderingContext2D;
    private readonly width: number;
    private readonly height: number;
    private background: HTMLCanvasElement | null = null;
    private uiScale = 1;

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d')!;
        this.width = FIELD.width;
        this.height = FIELD.height;
    }

    /**
     * 畫面被 CSS 縮到多小，字就要放多大。
     * 手機上 canvas 只有 380px 寬時，12px 的字實際只剩 5px，完全看不到。
     */
    static uiScaleFor(displayWidth: number): number {
        if (!displayWidth) return 1;
        return Math.min(Math.max(FIELD.width / displayWidth, 1), 2.8);
    }

    private font(size: number, weight = 600, mono = false): string {
        const family = mono
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : '"Inter", system-ui, sans-serif';
        return `${weight} ${(size * this.uiScale).toFixed(1)}px ${family}`;
    }

    /** 依裝置像素密度重設繪圖緩衝區，讓 Retina 螢幕不糊 */
    resize(): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** 地形固定不變，背景先畫好存起來，之後每幀只要貼圖 */
    buildBackground(state: ArtilleryState): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const layer = document.createElement('canvas');
        layer.width = this.width * dpr;
        layer.height = this.height * dpr;
        const ctx = layer.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.drawSky(ctx, state.seed);
        this.drawParallaxHills(ctx, state.seed);
        this.drawTerrain(ctx, state);

        this.background = layer;
    }

    private drawSky(ctx: CanvasRenderingContext2D, seed: number): void {
        const sky = ctx.createLinearGradient(0, 0, 0, this.height);
        sky.addColorStop(0, COLORS.skyTop);
        sky.addColorStop(0.55, COLORS.skyMid);
        sky.addColorStop(1, '#0a3a3f');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, this.width, this.height);

        const rng = mulberry32(seed ^ 0x5bf03635);

        // 星點只鋪在上半部，越靠近地平線越稀疏
        for (let i = 0; i < 70; i++) {
            const x = rng() * this.width;
            const y = rng() * this.height * 0.5;
            const alpha = (1 - y / (this.height * 0.5)) * 0.5 * rng();
            ctx.fillStyle = `rgba(253, 246, 227, ${alpha.toFixed(3)})`;
            ctx.fillRect(x, y, rng() * 1.6 + 0.6, rng() * 1.6 + 0.6);
        }

        // 低垂的夕陽 + 光暈，是整個畫面唯一的暖色來源
        const sunX = this.width * (0.25 + rng() * 0.5);
        const sunY = this.height * 0.52;

        const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, this.height * 0.75);
        glow.addColorStop(0, COLORS.glow);
        glow.addColorStop(0.35, 'rgba(181, 137, 0, 0.16)');
        glow.addColorStop(1, 'rgba(0, 43, 54, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = COLORS.sun;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    private drawParallaxHills(ctx: CanvasRenderingContext2D, seed: number): void {
        const layers = [
            { seed: seed ^ 0x1b873593, color: COLORS.farHill, minY: 0.46, maxY: 0.66, alpha: 0.85 },
            { seed: seed ^ 0x85ebca6b, color: COLORS.nearHill, minY: 0.55, maxY: 0.76, alpha: 0.95 },
        ];

        for (const layer of layers) {
            const ys = generateTerrain(mulberry32(layer.seed), {
                height: this.height,
                minYRatio: layer.minY,
                maxYRatio: layer.maxY,
                roughness: 0.48,
                points: 129,
            });

            ctx.globalAlpha = layer.alpha;
            ctx.fillStyle = layer.color;
            ctx.beginPath();
            ctx.moveTo(0, this.height);
            const spacing = this.width / (ys.length - 1);
            ys.forEach((y, i) => ctx.lineTo(i * spacing, y));
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    private drawTerrain(ctx: CanvasRenderingContext2D, state: ArtilleryState): void {
        const { groundYs, width } = state;
        const spacing = width / (groundYs.length - 1);

        const body = ctx.createLinearGradient(0, this.height * 0.3, 0, this.height);
        body.addColorStop(0, COLORS.terrainTop);
        body.addColorStop(1, COLORS.terrainBottom);

        ctx.beginPath();
        ctx.moveTo(0, this.height);
        groundYs.forEach((y, i) => ctx.lineTo(i * spacing, y));
        ctx.lineTo(width, this.height);
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();

        // 岩層紋理：把地形往下複製幾條淡線，免得整塊填色太平
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(253, 246, 227, 0.045)';
        ctx.lineWidth = 1;
        for (let offset = 22; offset < this.height; offset += 26) {
            ctx.beginPath();
            groundYs.forEach((y, i) => {
                const px = i * spacing;
                const py = y + offset;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            });
            ctx.stroke();
        }
        ctx.restore();

        // 地表稜線：亮邊讓地形跟天空分離
        ctx.beginPath();
        groundYs.forEach((y, i) => {
            const px = i * spacing;
            i === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
        });
        ctx.strokeStyle = COLORS.rim;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(253, 246, 227, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    render(view: ArtilleryView): void {
        const ctx = this.ctx;
        this.uiScale = ArtilleryRenderer.uiScaleFor(this.canvas.clientWidth);
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.save();

        if (view.shake > 0.1) {
            const angle = Math.random() * Math.PI * 2;
            ctx.translate(Math.cos(angle) * view.shake, Math.sin(angle) * view.shake);
        }

        if (this.background) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            ctx.drawImage(this.background, 0, 0, this.width * dpr, this.height * dpr, 0, 0, this.width, this.height);
        }

        this.drawPreview(view);
        this.drawTurret(view, 'player');
        this.drawTurret(view, 'enemy');
        this.drawDragBand(view);
        this.drawProjectile(view);
        this.drawExplosions(view);
        drawParticles(ctx, view.particles);
        this.drawFloaters(view);

        ctx.restore();
        this.drawStatus(view);
    }

    private drawPreview(view: ArtilleryView): void {
        if (view.preview.length < 2) return;
        const ctx = this.ctx;
        const total = view.preview.length;

        for (let i = 1; i < total; i++) {
            const point = view.preview[i];
            const fade = 1 - i / total;
            ctx.fillStyle = `rgba(253, 246, 227, ${(fade * 0.75).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2.6 * fade + 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawTurret(view: ArtilleryView, side: Side): void {
        const ctx = this.ctx;
        const pose = view.pose[side];
        const isPlayer = side === 'player';
        const main = isPlayer ? COLORS.player : COLORS.enemy;
        const dark = isPlayer ? COLORS.playerDark : COLORS.enemyDark;
        const facing = isPlayer ? 1 : -1;
        const { x, y } = pose;
        const pivotY = y - TURRET.pivotOffset;
        const angle = view.barrel[side];

        // 騰空時影子縮小變淡，彈跳的高度才看得出來
        const lift = Math.max(0, pose.groundY - y);
        const liftRatio = Math.min(lift / 26, 1);

        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${(0.35 - liftRatio * 0.18).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(pose.x, pose.groundY + 1, TURRET.hullWidth * (0.55 - liftRatio * 0.18), 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 車體：貼合地形斜度旋轉，砲管維持絕對角度（畫面角度必須等於實際射角）
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pose.tilt);

        const hw = TURRET.hullWidth / 2;
        const hh = TURRET.hullHeight;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(-hw, 0);
        ctx.lineTo(-hw * 0.7, -hh);
        ctx.lineTo(hw * 0.7, -hh);
        ctx.lineTo(hw, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.arc(0, -hh + 1, 11, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#01222b';
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(i * hw * 0.55, -3, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = 'rgba(253, 246, 227, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, -hh);
        ctx.lineTo(hw * 0.7, -hh);
        ctx.stroke();
        ctx.restore();

        // 砲管
        ctx.save();
        const radians = (angle * Math.PI) / 180;
        const tipX = x + facing * Math.cos(radians) * TURRET.barrelLength;
        const tipY = pivotY - Math.sin(radians) * TURRET.barrelLength;
        ctx.lineCap = 'round';
        ctx.strokeStyle = dark;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x, pivotY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.strokeStyle = main;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, pivotY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.restore();

        this.drawTurretHp(view, side);

        // 目前使用者輸入的角度／力道讀數
        if (isPlayer && !view.state.over) {
            ctx.font = this.font(12, 600, true);
            ctx.fillStyle = COLORS.textBright;
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(angle)}° · ${Math.round(view.power)}%`, x, y - 52 - (this.uiScale - 1) * 10);
        }
    }

    private drawTurretHp(view: ArtilleryView, side: Side): void {
        const ctx = this.ctx;
        const pose = view.pose[side];
        const hp = Math.max(0, view.displayHp[side]);
        const barWidth = 46;
        const barX = pose.x - barWidth / 2;
        const barY = pose.y - 42;

        ctx.fillStyle = 'rgba(0, 22, 29, 0.85)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, 6);

        const ratio = hp / COMBAT.maxHp;
        ctx.fillStyle = ratio > 0.5 ? COLORS.rim : ratio > 0.25 ? '#b58900' : '#dc322f';
        ctx.fillRect(barX, barY, barWidth * ratio, 4);
    }

    /** 拉弓式瞄準：從按下的那一點往回拉出橡皮筋，射擊方向是反向 */
    private drawDragBand(view: ArtilleryView): void {
        if (!view.drag) return;
        const ctx = this.ctx;
        const pivot = { x: view.pose.player.x, y: view.pose.player.y - TURRET.pivotOffset };
        const { start, pointer } = view.drag;

        ctx.save();
        ctx.strokeStyle = 'rgba(253, 246, 227, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 起點標記，讓玩家知道力道是從哪裡量起
        ctx.strokeStyle = 'rgba(253, 246, 227, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(start.x, start.y, 7, 0, Math.PI * 2);
        ctx.stroke();

        // 力道環：沿著砲台畫一段弧，滿力轉紅
        const ratio = view.power / 100;
        ctx.strokeStyle = ratio > 0.85 ? '#dc322f' : ratio > 0.6 ? '#b58900' : COLORS.rim;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, 40, Math.PI, Math.PI + Math.PI * ratio);
        ctx.stroke();

        ctx.fillStyle = 'rgba(253, 246, 227, 0.8)';
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private drawProjectile(view: ArtilleryView): void {
        if (!view.projectile) return;
        const ctx = this.ctx;
        const { pos, trail } = view.projectile;

        trail.forEach((point, index) => {
            const fade = (index + 1) / trail.length;
            ctx.fillStyle = `rgba(181, 137, 0, ${(fade * 0.6).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 1.2 + fade * 3.2, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.save();
        ctx.shadowColor = COLORS.sun;
        ctx.shadowBlur = 14;
        ctx.fillStyle = COLORS.shell;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private drawExplosions(view: ArtilleryView): void {
        const ctx = this.ctx;
        for (const explosion of view.explosions) {
            const t = explosion.age / explosion.duration;
            if (t >= 1) continue;

            const radius = explosion.radius * (0.35 + t * 0.65);

            ctx.strokeStyle = `rgba(203, 75, 22, ${(1 - t).toFixed(3)})`;
            ctx.lineWidth = 4 * (1 - t) + 1;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            const flash = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, radius * 0.8);
            flash.addColorStop(0, `rgba(253, 246, 227, ${((1 - t) * 0.75).toFixed(3)})`);
            flash.addColorStop(0.5, `rgba(181, 137, 0, ${((1 - t) * 0.35).toFixed(3)})`);
            flash.addColorStop(1, 'rgba(203, 75, 22, 0)');
            ctx.fillStyle = flash;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, radius * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawFloaters(view: ArtilleryView): void {
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.font = this.font(18, 700, true);

        for (const floater of view.floaters) {
            const t = floater.age / floater.duration;
            if (t >= 1) continue;
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = floater.color;
            ctx.fillText(floater.text, floater.x, floater.y - t * 34);
        }
        ctx.globalAlpha = 1;
    }

    private drawStatus(view: ArtilleryView): void {
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.font = this.font(13);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`第 ${view.stage} 關 · 第 ${view.state.round} 回合`, this.width / 2, 26 * this.uiScale);

        if (view.status) {
            ctx.font = this.font(16, 700);
            ctx.fillStyle = COLORS.textBright;
            ctx.fillText(view.status, this.width / 2, 48 * this.uiScale);
        }
    }
}
