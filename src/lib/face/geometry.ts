/**
 * 神諭石像臉 — 幾何 / 補間(純邏輯層)
 *
 * 無 DOM、無副作用、可單元測試。職責有二:
 *  1. 補間:lerpParams + easing,讓情緒之間平滑過渡。
 *  2. 幾何:把 FaceParams 翻成可直接畫的 SVG 路徑與座標。
 *
 * 座標系統對應 StatueFace.tsx 的 viewBox="0 0 400 480"。
 */

import type { FaceParams } from './emotions';

// ── 數值工具 ──────────────────────────────────────────────

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 平滑 easing(慢進慢出),用於情緒切換手感。 */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 逐欄位線性內插兩份參數。回傳新物件(immutable)。 */
export function lerpParams(a: FaceParams, b: FaceParams, t: number): FaceParams {
  return {
    eyeOpenness: lerp(a.eyeOpenness, b.eyeOpenness, t),
    eyeCurve: lerp(a.eyeCurve, b.eyeCurve, t),
    browInner: lerp(a.browInner, b.browInner, t),
    browOuter: lerp(a.browOuter, b.browOuter, t),
    browRaise: lerp(a.browRaise, b.browRaise, t),
    mouthCurve: lerp(a.mouthCurve, b.mouthCurve, t),
    mouthOpen: lerp(a.mouthOpen, b.mouthOpen, t),
    gazeX: lerp(a.gazeX, b.gazeX, t),
    gazeY: lerp(a.gazeY, b.gazeY, t),
    tear: lerp(a.tear, b.tear, t),
    grit: lerp(a.grit, b.grit, t),
    asymmetry: lerp(a.asymmetry, b.asymmetry, t),
    glow: lerp(a.glow, b.glow, t),
  };
}

// ── 版面錨點(集中常數,方便調校)────────────────────────

export const LAYOUT = {
  viewW: 400,
  viewH: 480,
  centerX: 200,
  eyeY: 222,
  leftEyeX: 148,
  rightEyeX: 252,
  eyeHalfW: 36,
  browBaseY: 174,
  mouthY: 362,
  mouthHalfW: 58,
} as const;

type Side = 'left' | 'right';

const round = (n: number): number => Math.round(n * 100) / 100;

// ── 眼睛 ──────────────────────────────────────────────────

/** 單眼閉合路徑(杏仁形,上下兩條二次曲線)。 */
export function eyePath(side: Side, p: FaceParams): string {
  const cx = side === 'left' ? LAYOUT.leftEyeX : LAYOUT.rightEyeX;
  const cy = LAYOUT.eyeY;
  const hw = LAYOUT.eyeHalfW;

  // 不對稱:左眼瞇起(疑)
  let op = p.eyeOpenness;
  if (side === 'left') op *= 1 - 0.72 * p.asymmetry;
  op = clamp(op, 0, 1);

  const lidH = 5 + op * 26; // 眼睛半開高度

  // eyeCurve 對上下眼瞼的影響不對稱 → 笑眼呈上拱新月、哀眼呈下垂
  const upperShift = -p.eyeCurve * 6;
  const lowerShift = -p.eyeCurve * 20;

  // 外眼角下垂(哀)/上提(喜)
  const outerDy = -p.eyeCurve * 8;
  const innerX = side === 'left' ? cx + hw : cx - hw;
  const outerX = side === 'left' ? cx - hw : cx + hw;
  const innerY = cy;
  const outerY = cy + outerDy;

  const topCtrlY = cy - lidH + upperShift;
  const botCtrlY = cy + lidH * 0.85 + lowerShift;

  return (
    `M ${round(outerX)},${round(outerY)} ` +
    `Q ${round(cx)},${round(topCtrlY)} ${round(innerX)},${round(innerY)} ` +
    `Q ${round(cx)},${round(botCtrlY)} ${round(outerX)},${round(outerY)} Z`
  );
}

/** 瞳孔位置與半徑(隨 gaze 平移,隨 openness 縮放)。 */
export function pupilPos(
  side: Side,
  p: FaceParams,
): { cx: number; cy: number; r: number } {
  const baseX = side === 'left' ? LAYOUT.leftEyeX : LAYOUT.rightEyeX;
  let op = p.eyeOpenness;
  if (side === 'left') op *= 1 - 0.72 * p.asymmetry;
  op = clamp(op, 0, 1);
  return {
    cx: round(baseX + p.gazeX * 14),
    cy: round(LAYOUT.eyeY + p.gazeY * 9),
    r: round(7 + op * 3),
  };
}

/** 瞳孔整體透明度(眼睛快閉合時淡出)。 */
export const pupilOpacity = (p: FaceParams): number =>
  round(clamp((p.eyeOpenness - 0.08) / 0.25, 0, 1));

// ── 眉毛 ──────────────────────────────────────────────────

/** 單側眉毛(略帶弧度的粗線 path)。 */
export function browPath(side: Side, p: FaceParams): string {
  const eyeX = side === 'left' ? LAYOUT.leftEyeX : LAYOUT.rightEyeX;
  const innerX = side === 'left' ? eyeX + 30 : eyeX - 30;
  const outerX = side === 'left' ? eyeX - 40 : eyeX + 40;

  const raise = -p.browRaise * 22; // 整體抬高(負 y)
  let yInner = LAYOUT.browBaseY + raise + p.browInner * 20;
  let yOuter = LAYOUT.browBaseY + raise + p.browOuter * 20;

  // 不對稱:右眉額外挑高(疑)
  if (side === 'right') {
    yInner -= p.asymmetry * 22;
    yOuter -= p.asymmetry * 16;
  }

  const midX = (innerX + outerX) / 2;
  const midY = Math.min(yInner, yOuter) - 6; // 略向上拱

  return (
    `M ${round(outerX)},${round(yOuter)} ` +
    `Q ${round(midX)},${round(midY)} ${round(innerX)},${round(yInner)}`
  );
}

// ── 嘴巴 ──────────────────────────────────────────────────

/** 嘴巴閉合路徑(上下唇兩條曲線圍成)。 */
export function mouthPath(p: FaceParams): string {
  const cx = LAYOUT.centerX;
  const cy = LAYOUT.mouthY;
  const hw = LAYOUT.mouthHalfW;

  const cornerDy = -p.mouthCurve * 22; // 笑→嘴角上提(負 y)
  const open = clamp(p.mouthOpen, 0, 1);

  const lx = cx - hw;
  const rx = cx + hw;
  const ly = cy + cornerDy;

  const topCtrlY = cy - 4 - open * 6 + cornerDy * 0.5;
  const botCtrlY = cy + 6 + open * 48 + cornerDy * 0.5;

  return (
    `M ${round(lx)},${round(ly)} ` +
    `Q ${round(cx)},${round(topCtrlY)} ${round(rx)},${round(ly)} ` +
    `Q ${round(cx)},${round(botCtrlY)} ${round(lx)},${round(ly)} Z`
  );
}

/** 咬牙時的牙列方塊(嘴張開且 grit 高時顯示)。回傳 null 表示不顯示。 */
export function teethRect(
  p: FaceParams,
): { x: number; y: number; w: number; h: number } | null {
  const open = clamp(p.mouthOpen, 0, 1);
  if (p.grit < 0.05 || open < 0.04) return null;
  const cx = LAYOUT.centerX;
  const hw = LAYOUT.mouthHalfW * 0.82;
  return {
    x: round(cx - hw),
    y: round(LAYOUT.mouthY - 2),
    w: round(hw * 2),
    h: round(8 + open * 10),
  };
}

export const teethOpacity = (p: FaceParams): number => round(clamp(p.grit, 0, 1));

// ── 眼淚 ──────────────────────────────────────────────────

/** 左眼下方淚滴 path(固定位置,透明度由 tear 控制)。 */
export function tearPath(p: FaceParams): { d: string; opacity: number } {
  const x = LAYOUT.leftEyeX - 22;
  const y = LAYOUT.eyeY + 14;
  const fall = p.tear * 26; // tear 越大滴得越低
  const cy = y + fall;
  // 淚滴:尖端在上、圓肚在下
  const d =
    `M ${round(x)},${round(cy - 11)} ` +
    `C ${round(x + 7)},${round(cy - 2)} ${round(x + 7)},${round(cy + 8)} ${round(x)},${round(cy + 8)} ` +
    `C ${round(x - 7)},${round(cy + 8)} ${round(x - 7)},${round(cy - 2)} ${round(x)},${round(cy - 11)} Z`;
  return { d, opacity: round(clamp(p.tear, 0, 1)) };
}

// ── 聚合 ──────────────────────────────────────────────────

export interface FaceGeometry {
  leftEye: string;
  rightEye: string;
  leftPupil: { cx: number; cy: number; r: number };
  rightPupil: { cx: number; cy: number; r: number };
  pupilOpacity: number;
  leftBrow: string;
  rightBrow: string;
  mouth: string;
  teeth: { x: number; y: number; w: number; h: number } | null;
  teethOpacity: number;
  tear: { d: string; opacity: number };
  glow: number;
}

/** 一次算出整張臉的全部幾何。 */
export function computeGeometry(p: FaceParams): FaceGeometry {
  return {
    leftEye: eyePath('left', p),
    rightEye: eyePath('right', p),
    leftPupil: pupilPos('left', p),
    rightPupil: pupilPos('right', p),
    pupilOpacity: pupilOpacity(p),
    leftBrow: browPath('left', p),
    rightBrow: browPath('right', p),
    mouth: mouthPath(p),
    teeth: teethRect(p),
    teethOpacity: teethOpacity(p),
    tear: tearPath(p),
    glow: round(clamp(p.glow, 0, 1)),
  };
}
