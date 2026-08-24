/**
 * Initial conditions for the N-body page.
 *
 * The set is chosen to tell one story in order:
 *   binary        — two bodies, closed orbit, drift meter flat. "Stable."
 *   sun-planet    — a hierarchical three-body that is *also* stable, so
 *                   "three bodies = chaos" doesn't get learned as a rule.
 *   figure-eight  — the famous exact three-body solution. Beautiful, and
 *                   razor-thin: perturb it and it dies. That is the lesson.
 *   lagrange      — an exact solution that *looks* stable and isn't (equal
 *                   masses are linearly unstable; it breaks up on its own).
 *   pythagorean   — Burrau's problem, the canonical violent three-body chaos.
 *   double-binary — four bodies, hierarchical, showing N > 3 is fine.
 *   random        — N = 2…10, the extension hook.
 *
 * All values are in G = 1 units.
 */
import { G } from './NBodyCore';
import type { BodyInit } from './NBodyCore';

export interface PresetParams {
  /** Body count, only honoured by presets with `variableN: true`. */
  n: number;
  /** Seed for the randomised presets, so a reset reproduces the same run. */
  seed: number;
}

export interface NBodyPreset {
  id: string;
  emoji: string;
  name: string;
  /** One line under the preset buttons — what to look for. */
  blurb: string;
  /** Presets with close encounters need a smaller ε than the default. */
  softening: number;
  variableN?: boolean;
  build(params: PresetParams): BodyInit[];
}

/** mulberry32 — tiny deterministic PRNG so "random" runs are reproducible. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BINARY: NBodyPreset = {
  id: 'binary',
  emoji: '💫',
  name: '雙星互繞',
  blurb: '兩個等質量天體的圓軌道。看「能量漂移」讀數幾乎不動 — 這就是二體問題可解、且封閉的意思。',
  softening: 0.01,
  build: () => {
    // Equal masses, separation d = 1 ⇒ relative speed √(G·M_total/d) = √2,
    // split evenly between the two bodies.
    const v = Math.SQRT2 / 2;
    return [
      { mass: 1, x: 0.5, y: 0, vx: 0, vy: v, label: '主星 A' },
      { mass: 1, x: -0.5, y: 0, vx: 0, vy: -v, label: '主星 B' },
    ];
  },
};

const SUN_PLANET_MOON: NBodyPreset = {
  id: 'sun-planet-moon',
  emoji: '🌍',
  name: '太陽-行星-衛星',
  blurb: '三體，但質量差距懸殊、軌道分層。它穩定 — 所以「三體必混沌」是錯的，真正的條件是層級分離。',
  softening: 0.01,
  build: () => {
    const mSun = 1;
    const mPlanet = 0.04;
    const mMoon = 0.0002;
    const a = 2; // planet semi-major axis
    const b = 0.18; // moon orbit radius; Hill radius here is ≈ 0.47, so this sits well inside
    const vPlanet = Math.sqrt((G * (mSun + mPlanet)) / a);
    const vMoon = Math.sqrt((G * mPlanet) / b);
    return [
      { mass: mSun, x: 0, y: 0, vx: 0, vy: 0, label: '太陽' },
      { mass: mPlanet, x: a, y: 0, vx: 0, vy: vPlanet, label: '行星' },
      { mass: mMoon, x: a + b, y: 0, vx: 0, vy: vPlanet + vMoon, label: '衛星' },
    ];
  },
};

const FIGURE_EIGHT: NBodyPreset = {
  id: 'figure-eight',
  emoji: '♾️',
  name: '八字形三體',
  blurb: 'Chenciner–Montgomery 解：三個等質量天體追著彼此跑同一條 8 字。它是精確解，但把 δ 調大一點就會崩 — 穩定 ≠ 強韌。',
  softening: 0.002,
  build: () => {
    // Chenciner & Montgomery (2000), the standard numerical initial condition.
    const x = 0.97000436;
    const y = -0.24308753;
    const v3x = -0.93240737;
    const v3y = -0.86473146;
    return [
      { mass: 1, x, y, vx: -v3x / 2, vy: -v3y / 2, label: '天體 1' },
      { mass: 1, x: -x, y: -y, vx: -v3x / 2, vy: -v3y / 2, label: '天體 2' },
      { mass: 1, x: 0, y: 0, vx: v3x, vy: v3y, label: '天體 3' },
    ];
  },
};

const LAGRANGE: NBodyPreset = {
  id: 'lagrange',
  emoji: '🔺',
  name: '拉格朗日三角',
  blurb: '三個等質量天體維持正三角形一起旋轉，也是精確解 — 但等質量時它「線性不穩定」。放著別動，看它自己解體。',
  softening: 0.01,
  build: () => {
    // Equilateral triangle, side s = 1 ⇒ circumradius R = 1/√3, ω = √(G·M/s³) = √3.
    const r = 1 / Math.sqrt(3);
    const omega = Math.sqrt(3);
    const labels = ['天體 1', '天體 2', '天體 3'];
    return [0, 1, 2].map((k) => {
      const theta = Math.PI / 2 + (k * 2 * Math.PI) / 3;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      return { mass: 1, x, y, vx: -omega * y, vy: omega * x, label: labels[k] };
    });
  },
};

const PYTHAGOREAN: NBodyPreset = {
  id: 'pythagorean',
  emoji: '💥',
  name: '畢氏三體（Burrau）',
  blurb: '質量 3:4:5 擺在直角三角形的頂點，初速為零。經典的暴力混沌 — 近距離飛掠、彈射，最後常留下一組雙星加一顆逃逸體。',
  softening: 0.02,
  build: () => [
    { mass: 3, x: 1, y: 3, vx: 0, vy: 0, label: 'm = 3' },
    { mass: 4, x: -2, y: -1, vx: 0, vy: 0, label: 'm = 4' },
    { mass: 5, x: 1, y: -1, vx: 0, vy: 0, label: 'm = 5' },
  ],
};

const DOUBLE_BINARY: NBodyPreset = {
  id: 'double-binary',
  emoji: '🎠',
  name: '雙雙星（4 體）',
  blurb: '兩組緊密雙星再互繞。內外軌道尺度差 7 倍，所以四體照樣穩 — 層級分離才是關鍵，不是數量。',
  softening: 0.01,
  build: () => {
    const inner = 0.4; // separation inside each binary
    const outer = 3; // separation between the two binaries' centres
    const vInner = Math.sqrt((G * 1) / inner) / 2;
    const vOuter = Math.sqrt((G * 2) / outer) / 2;
    return [
      { mass: 0.5, x: -outer / 2, y: inner / 2, vx: -vInner, vy: -vOuter, label: 'A1' },
      { mass: 0.5, x: -outer / 2, y: -inner / 2, vx: vInner, vy: -vOuter, label: 'A2' },
      { mass: 0.5, x: outer / 2, y: inner / 2, vx: -vInner, vy: vOuter, label: 'B1' },
      { mass: 0.5, x: outer / 2, y: -inner / 2, vx: vInner, vy: vOuter, label: 'B2' },
    ];
  },
};

const RANDOM: NBodyPreset = {
  id: 'random',
  emoji: '🎲',
  name: '隨機 N 體',
  blurb: '拉「天體數量」到 2…10。隨機初始條件幾乎必定混沌 — 而且 N 越大，逃逸與雙星俘獲越早發生。',
  softening: 0.03,
  variableN: true,
  build: ({ n, seed }) => {
    const rng = makeRng(seed);
    const count = Math.max(2, Math.min(10, Math.round(n)));
    const bodies: BodyInit[] = [];
    for (let i = 0; i < count; i++) {
      // Roughly uniform over a disc, with a mild tangential kick so the
      // cluster swirls instead of just collapsing straight to the centre.
      const radius = 2.2 * Math.sqrt(rng());
      const theta = rng() * Math.PI * 2;
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      const speed = 0.35 + rng() * 0.35;
      bodies.push({
        mass: 0.4 + rng() * 0.9,
        x,
        y,
        vx: -speed * Math.sin(theta) + (rng() - 0.5) * 0.25,
        vy: speed * Math.cos(theta) + (rng() - 0.5) * 0.25,
        label: `天體 ${i + 1}`,
      });
    }
    return bodies;
  },
};

export const NBODY_PRESETS: readonly NBodyPreset[] = [
  BINARY,
  SUN_PLANET_MOON,
  FIGURE_EIGHT,
  LAGRANGE,
  PYTHAGOREAN,
  DOUBLE_BINARY,
  RANDOM,
];

export function getPreset(id: string): NBodyPreset {
  return NBODY_PRESETS.find((p) => p.id === id) ?? BINARY;
}

/** Palette for body markers — Solarized accents, assigned by index. */
export const BODY_COLORS: readonly string[] = [
  '#268bd2', // blue
  '#cb4b16', // orange
  '#2aa198', // cyan
  '#d33682', // magenta
  '#859900', // green
  '#b58900', // yellow
  '#6c71c4', // violet
  '#dc322f', // red
  '#93a1a1', // base-400
  '#eee8d5', // base-100
];
