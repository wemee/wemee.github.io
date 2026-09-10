/**
 * 地形產生：一維 midpoint displacement（fractal 山稜）。
 *
 * 產出的是一條「地表 y 座標」高度陣列（Canvas 座標，y 往下為正），
 * 均勻分佈在 0 ~ width 之間，中間位置用線性內插取值。
 * 地形不可破壞，所以整局只在 reset() 產生一次。
 */

import { TERRAIN } from './config';
import { clamp, lerp, smoothstep, type Rng } from './random';

export interface TerrainOptions {
    height: number;
    /** 地表最高處（畫布高度比例） */
    minYRatio?: number;
    /** 地表最低處 */
    maxYRatio?: number;
    roughness?: number;
    points?: number;
}

/**
 * 產生地形高度陣列。
 * @param rng 已設定種子的亂數來源
 */
export function generateTerrain(rng: Rng, options: TerrainOptions): number[] {
    const {
        height,
        minYRatio = TERRAIN.minYRatio,
        maxYRatio = TERRAIN.maxYRatio,
        roughness = TERRAIN.roughness,
        points = TERRAIN.points,
    } = options;

    const minY = height * minYRatio;
    const maxY = height * maxYRatio;
    const ys = new Array<number>(points);

    // 兩端點先隨機，再逐層對半細分
    ys[0] = lerp(minY, maxY, 0.35 + rng() * 0.5);
    ys[points - 1] = lerp(minY, maxY, 0.35 + rng() * 0.5);

    let step = points - 1;
    let amplitude = (maxY - minY) * 0.62;

    while (step > 1) {
        const half = step >> 1;
        for (let i = half; i < points; i += step) {
            const midpoint = (ys[i - half] + ys[i + half]) / 2;
            ys[i] = midpoint + (rng() - 0.5) * amplitude;
        }
        amplitude *= roughness;
        step = half;
    }

    smoothInPlace(ys, 2);

    for (let i = 0; i < points; i++) {
        ys[i] = clamp(ys[i], minY, maxY);
    }

    return ys;
}

/** 移動平均，磨掉 midpoint displacement 留下的鋸齒 */
function smoothInPlace(ys: number[], passes: number): void {
    for (let pass = 0; pass < passes; pass++) {
        const source = ys.slice();
        for (let i = 1; i < ys.length - 1; i++) {
            ys[i] = (source[i - 1] + source[i] * 2 + source[i + 1]) / 4;
        }
    }
}

/**
 * 把砲台底下壓平成平台，邊緣做平滑融合避免出現直角斷崖。
 * @returns 平台高度（砲台的地面 y）
 */
export function flattenPad(ys: number[], width: number, padX: number): number {
    const spacing = width / (ys.length - 1);
    const half = TERRAIN.padHalfWidth;
    const blend = TERRAIN.padBlend;

    const from = Math.max(0, Math.floor((padX - half) / spacing));
    const to = Math.min(ys.length - 1, Math.ceil((padX + half) / spacing));

    let sum = 0;
    for (let i = from; i <= to; i++) sum += ys[i];
    const padY = sum / (to - from + 1);

    const outerFrom = Math.max(0, Math.floor((padX - half - blend) / spacing));
    const outerTo = Math.min(ys.length - 1, Math.ceil((padX + half + blend) / spacing));

    for (let i = outerFrom; i <= outerTo; i++) {
        const distance = Math.abs(i * spacing - padX);
        if (distance <= half) {
            ys[i] = padY;
        } else {
            const t = smoothstep((distance - half) / blend);
            ys[i] = lerp(padY, ys[i], t);
        }
    }

    return padY;
}

/** 取得任意 x 的地表 y（線性內插） */
export function groundYAt(ys: number[], width: number, x: number): number {
    const spacing = width / (ys.length - 1);
    const position = clamp(x / spacing, 0, ys.length - 1);
    const index = Math.floor(position);
    if (index >= ys.length - 1) return ys[ys.length - 1];
    return lerp(ys[index], ys[index + 1], position - index);
}
