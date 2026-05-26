import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import { FUNCTION_PRESETS, type FunctionPreset } from './presets';

/**
 * Two stacked plots demonstrating the fundamental theorem of calculus.
 *
 * Top: f(t) over the visible range, with the area from a to x shaded.
 * Bottom: F(x) = ∫_a^x f(t) dt — the area-as-function-of-upper-bound curve,
 *         with a tangent at x whose slope (by FTC) equals f(x).
 *
 * Dragging x simultaneously grows/shrinks the shaded area on top and slides
 * the marker on bottom, so the learner can compare "height of f at x" against
 * "slope of F at x" — they're the same number.
 */
export interface FTCState {
  a: number;
  x: number;
  fx: number;       // f(x) — height of top curve at x
  Fx: number;       // F(x) — value of bottom curve at x
  topFpx: number;   // slope of F at x (should equal fx by FTC)
}

export interface FTCSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (s: FTCState) => void;
}

const COLORS = {
  axis: 'rgba(255, 255, 255, 0.22)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axisLabel: 'rgba(255, 255, 255, 0.5)',
  curveF: '#00e5ff',     // f(t)
  curveBigF: '#ffd54f',  // F(x) on lower plot
  shadePos: 'rgba(0, 229, 255, 0.25)',
  shadeNeg: 'rgba(255, 107, 157, 0.25)',
  tangent: '#ff6b9d',
  point: '#ffffff',
  guide: 'rgba(255, 213, 79, 0.35)',
};

interface PlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
  yMin: number;
  yMax: number;
}

const SAMPLES_F = 320;          // for drawing the top f(t) curve
const SAMPLES_BIGF = 200;       // sample points on bottom F curve
const SAMPLES_PER_INTEGRAL = 200; // sub-intervals when computing F(x) by quadrature

export class FTCScene extends Canvas2DBase {
  private preset: FunctionPreset;
  private a = -1;
  private x = 0.5;
  private onUpdate?: (s: FTCState) => void;

  private xMin = -2;
  private xMax = 2;
  private topYMin = -1;
  private topYMax = 4;
  private bottomYMin = -1;
  private bottomYMax = 4;

  // Cache F samples so repeated draws don't recompute. Invalidated on preset
  // or a-change.
  private bigFCache: number[] = [];
  private bigFXs: number[] = [];

  private readonly margin = { top: 16, right: 16, bottom: 22, left: 38 };
  private readonly gap = 26;

  constructor(options: FTCSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.preset = FUNCTION_PRESETS.find((p) => p.id === 'parabola')!;
    this.recalcRanges();
    this.recalcBigFCache();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setPreset(id: string): void {
    const next = FUNCTION_PRESETS.find((p) => p.id === id);
    if (!next) return;
    this.preset = next;
    [this.xMin, this.xMax] = next.range;
    // Shrink slightly so a/x have room.
    const mid = (this.xMin + this.xMax) / 2;
    const half = (this.xMax - this.xMin) * 0.4;
    this.xMin = mid - half;
    this.xMax = mid + half;
    this.a = this.xMin;
    this.x = mid;
    this.recalcRanges();
    this.recalcBigFCache();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setA(a: number): void {
    this.a = a;
    this.recalcBigFCache();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setX(x: number): void {
    this.x = x;
    this.emitUpdate();
    this.scheduleRender();
  }

  public getXRange(): [number, number] {
    return [this.xMin, this.xMax];
  }

  private recalcRanges(): void {
    // Top y-range: from f sampling.
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const t = this.xMin + (i / 200) * (this.xMax - this.xMin);
      const y = this.preset.f(t);
      if (Number.isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; }
    }
    const padTop = Math.max((hi - lo) * 0.12, 0.5);
    this.topYMin = Math.min(0, lo - padTop);
    this.topYMax = Math.max(0, hi + padTop);
  }

  private recalcBigFCache(): void {
    // Build cumulative F(x) = ∫_a^x f(t) dt via midpoint rule. Storing the
    // running sum at SAMPLES_BIGF + 1 sample points; intermediate F(x) for
    // emitUpdate is interpolated from this cache.
    const n = SAMPLES_BIGF;
    this.bigFXs = new Array(n + 1);
    this.bigFCache = new Array(n + 1);
    const dx = (this.xMax - this.xMin) / n;

    // First: build the F cache aligned to the plot x grid, but anchored at a.
    // F at sample i is F(xMin + i*dx) = ∫_a^{xMin + i*dx} f(t) dt.
    for (let i = 0; i <= n; i++) {
      this.bigFXs[i] = this.xMin + i * dx;
    }
    for (let i = 0; i <= n; i++) {
      this.bigFCache[i] = this.integrate(this.a, this.bigFXs[i]);
    }
    // Auto-fit bottom y-range from cache.
    let lo = Infinity, hi = -Infinity;
    for (const v of this.bigFCache) {
      if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    if (lo === Infinity) { lo = -1; hi = 1; }
    const pad = Math.max((hi - lo) * 0.15, 0.5);
    this.bottomYMin = Math.min(0, lo - pad);
    this.bottomYMax = Math.max(0, hi + pad);
  }

  /** Midpoint-rule integral of f from u to v (handles v < u via sign flip). */
  private integrate(u: number, v: number): number {
    if (u === v) return 0;
    const sign = v >= u ? 1 : -1;
    const lo = Math.min(u, v);
    const hi = Math.max(u, v);
    const n = SAMPLES_PER_INTEGRAL;
    const dx = (hi - lo) / n;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const sample = lo + (i + 0.5) * dx;
      const y = this.preset.f(sample);
      if (!Number.isFinite(y)) return NaN;
      total += y * dx;
    }
    return sign * total;
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const fx = this.preset.f(this.x);
    const Fx = this.integrate(this.a, this.x);
    // dF/dx by finite difference (small h).
    const h = 1e-4;
    const topFpx = (this.integrate(this.a, this.x + h) - this.integrate(this.a, this.x - h)) / (2 * h);
    this.onUpdate({ a: this.a, x: this.x, fx, Fx, topFpx });
  }

  private rectFor(which: 'top' | 'bottom'): PlotRect {
    const totalH = this.height - this.margin.top - this.margin.bottom - this.gap;
    const eachH = totalH / 2;
    const w = this.width - this.margin.left - this.margin.right;
    if (which === 'top') {
      return { x: this.margin.left, y: this.margin.top, w, h: eachH, yMin: this.topYMin, yMax: this.topYMax };
    }
    return {
      x: this.margin.left,
      y: this.margin.top + eachH + this.gap,
      w,
      h: eachH,
      yMin: this.bottomYMin,
      yMax: this.bottomYMax,
    };
  }

  private worldToScreen(rect: PlotRect, wx: number, wy: number): { sx: number; sy: number } {
    const sx = rect.x + ((wx - this.xMin) / (this.xMax - this.xMin)) * rect.w;
    const sy = rect.y + ((rect.yMax - wy) / (rect.yMax - rect.yMin)) * rect.h;
    return { sx, sy };
  }

  protected draw(): void {
    const top = this.rectFor('top');
    const bot = this.rectFor('bottom');
    this.drawSubplotChrome(top, 'f(t)', COLORS.curveF);
    this.drawShadedArea(top);
    this.drawCurveIn(top, (t) => this.preset.f(t), COLORS.curveF);
    this.drawAMarker(top);
    this.drawXPoint(top, this.preset.f(this.x));

    this.drawSubplotChrome(bot, 'F(x) = ∫ₐˣ f(t) dt', COLORS.curveBigF);
    this.drawBigFCurve(bot);
    this.drawBigFTangent(bot);
    this.drawXPoint(bot, this.sampleBigF(this.x));

    this.drawSharedXGuide();
  }

  private drawSubplotChrome(rect: PlotRect, title: string, titleColor: string): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    ctx.fillStyle = titleColor;
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, rect.x + 8, rect.y + 6);

    this.drawAxesIn(rect);
  }

  private drawAxesIn(rect: PlotRect): void {
    const { ctx } = this;
    const xStep = niceStep((this.xMax - this.xMin) / 5);
    const yStep = niceStep((rect.yMax - rect.yMin) / 4);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(this.xMin / xStep) * xStep; x <= this.xMax; x += xStep) {
      const { sx } = this.worldToScreen(rect, x, 0);
      ctx.moveTo(sx, rect.y);
      ctx.lineTo(sx, rect.y + rect.h);
    }
    for (let y = Math.ceil(rect.yMin / yStep) * yStep; y <= rect.yMax; y += yStep) {
      const { sy } = this.worldToScreen(rect, 0, y);
      ctx.moveTo(rect.x, sy);
      ctx.lineTo(rect.x + rect.w, sy);
    }
    ctx.stroke();

    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    if (rect.yMin <= 0 && rect.yMax >= 0) {
      const { sy } = this.worldToScreen(rect, 0, 0);
      ctx.moveTo(rect.x, sy);
      ctx.lineTo(rect.x + rect.w, sy);
    }
    if (this.xMin <= 0 && this.xMax >= 0) {
      const { sx } = this.worldToScreen(rect, 0, 0);
      ctx.moveTo(sx, rect.y);
      ctx.lineTo(sx, rect.y + rect.h);
    }
    ctx.stroke();

    ctx.fillStyle = COLORS.axisLabel;
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(rect.yMin / yStep) * yStep; y <= rect.yMax; y += yStep) {
      if (Math.abs(y) < yStep / 4) continue;
      const { sy } = this.worldToScreen(rect, 0, y);
      ctx.fillText(formatTick(y), rect.x - 4, sy);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(this.xMin / xStep) * xStep; x <= this.xMax; x += xStep) {
      if (Math.abs(x) < xStep / 4) continue;
      const { sx } = this.worldToScreen(rect, x, 0);
      ctx.fillText(formatTick(x), sx, rect.y + rect.h + 3);
    }
  }

  private drawShadedArea(rect: PlotRect): void {
    const { ctx } = this;
    if (this.a === this.x) return;
    const lo = Math.min(this.a, this.x);
    const hi = Math.max(this.a, this.x);
    const baseY = this.worldToScreen(rect, 0, 0).sy;
    const samples = 160;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    // Walk along the curve, building a closed polygon with the x-axis.
    let polyHasArea = false;
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= samples; i++) {
      const t = lo + (i / samples) * (hi - lo);
      const y = this.preset.f(t);
      if (!Number.isFinite(y)) continue;
      const { sx, sy } = this.worldToScreen(rect, t, y);
      if (first) {
        const { sx: sx0 } = this.worldToScreen(rect, t, 0);
        ctx.moveTo(sx0, baseY);
        ctx.lineTo(sx, sy);
        first = false;
      } else {
        ctx.lineTo(sx, sy);
        polyHasArea = true;
      }
    }
    const { sx: sxEnd } = this.worldToScreen(rect, hi, 0);
    ctx.lineTo(sxEnd, baseY);
    ctx.closePath();
    if (polyHasArea) {
      // Use cyan if integrating left→right (positive direction by convention).
      ctx.fillStyle = this.x >= this.a ? COLORS.shadePos : COLORS.shadeNeg;
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAMarker(rect: PlotRect): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1.5;
    const { sx } = this.worldToScreen(rect, this.a, 0);
    ctx.beginPath();
    ctx.moveTo(sx, rect.y);
    ctx.lineTo(sx, rect.y + rect.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('a', sx, rect.y + rect.h - 14);
    ctx.restore();
  }

  private drawCurveIn(rect: PlotRect, fn: (x: number) => number, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= SAMPLES_F; i++) {
      const x = this.xMin + (i / SAMPLES_F) * (this.xMax - this.xMin);
      const y = fn(x);
      if (!Number.isFinite(y)) { started = false; continue; }
      const { sx, sy } = this.worldToScreen(rect, x, y);
      if (!started) { ctx.moveTo(sx, sy); started = true; }
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  private sampleBigF(x: number): number {
    if (this.bigFCache.length === 0) return NaN;
    // Linear interpolation from cached samples.
    const n = this.bigFCache.length - 1;
    const t = (x - this.xMin) / (this.xMax - this.xMin);
    const idx = t * n;
    if (idx <= 0) return this.bigFCache[0];
    if (idx >= n) return this.bigFCache[n];
    const lo = Math.floor(idx);
    const frac = idx - lo;
    return this.bigFCache[lo] * (1 - frac) + this.bigFCache[lo + 1] * frac;
  }

  private drawBigFCurve(rect: PlotRect): void {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = COLORS.curveBigF;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < this.bigFXs.length; i++) {
      const x = this.bigFXs[i];
      const y = this.bigFCache[i];
      if (!Number.isFinite(y)) { started = false; continue; }
      const { sx, sy } = this.worldToScreen(rect, x, y);
      if (!started) { ctx.moveTo(sx, sy); started = true; }
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawBigFTangent(rect: PlotRect): void {
    const { ctx } = this;
    const y0 = this.sampleBigF(this.x);
    const m = this.preset.f(this.x); // FTC: F'(x) = f(x)
    if (!Number.isFinite(y0) || !Number.isFinite(m)) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = COLORS.tangent;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    const yLeft = y0 + m * (this.xMin - this.x);
    const yRight = y0 + m * (this.xMax - this.x);
    const a = this.worldToScreen(rect, this.xMin, yLeft);
    const b = this.worldToScreen(rect, this.xMax, yRight);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.restore();
  }

  private drawXPoint(rect: PlotRect, y0: number): void {
    if (!Number.isFinite(y0)) return;
    const { ctx } = this;
    const { sx, sy } = this.worldToScreen(rect, this.x, y0);
    ctx.fillStyle = COLORS.point;
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSharedXGuide(): void {
    const { ctx } = this;
    const topRect = this.rectFor('top');
    const { sx } = this.worldToScreen(topRect, this.x, 0);
    ctx.save();
    ctx.strokeStyle = COLORS.guide;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, this.margin.top);
    ctx.lineTo(sx, this.height - this.margin.bottom);
    ctx.stroke();
    ctx.restore();
  }
}

function niceStep(raw: number): number {
  if (raw <= 0 || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const m = raw / base;
  let nice: number;
  if (m < 1.5) nice = 1;
  else if (m < 3) nice = 2;
  else if (m < 7) nice = 5;
  else nice = 10;
  return nice * base;
}

function formatTick(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) < 0.01 || Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(2).replace(/\.?0+$/, '');
}
