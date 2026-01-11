import type { Particle } from './types';

/**
 * 遊戲共用工具函數
 */

/**
 * 顯示指定的 overlay
 */
export function showOverlay(id: string): void {
    document.getElementById(id)?.classList.remove('hidden');
}

/**
 * 隱藏指定的 overlay
 */
export function hideOverlay(id: string): void {
    document.getElementById(id)?.classList.add('hidden');
}

/**
 * 在指定位置產生粒子效果
 */
export function spawnParticles(
    particles: Particle[],
    x: number,
    y: number,
    color: string,
    count: number
): void {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

/**
 * 更新粒子狀態，回傳存活的粒子
 */
export function updateParticles(particles: Particle[], gravity: number = 0.2, decay: number = 0.02): Particle[] {
    return particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.life -= decay;
        return p.life > 0;
    });
}

/**
 * 繪製粒子
 */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/**
 * 繪製圓角矩形
 */
export function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
}
