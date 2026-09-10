/**
 * 可重現的偽亂數工具。
 * 地形與 AI 誤差都走這裡，測試才能釘住種子重現同一局。
 */

export type Rng = () => number;

/** mulberry32：小、快、分佈夠好的 32-bit PRNG */
export function mulberry32(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Box-Muller 常態分佈取樣（標準常態，平均 0 標準差 1） */
export function gaussian(rng: Rng): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** 平滑插值曲線，用於地形平台的邊緣融合 */
export function smoothstep(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}
