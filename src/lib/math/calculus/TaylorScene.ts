import { Canvas2DBase, type Canvas2DBaseOptions } from '../Canvas2DBase';
import { FUNCTION_PRESETS, type FunctionPreset } from './presets';

/**
 * Plot of f(x) alongside its Taylor polynomial of order n centred at a.
 * Drag a to move the expansion centre; drag n to add more terms and watch
 * the approximation extend its radius of convergence (or fail entirely for
 * cubic outside the polynomial's degree limit).
 */
export interface TaylorState {
  a: number;
  n: number;
  fx0: number;      // f at the expansion centre
  tnAtA: number;    // T_n at the expansion centre (sanity check; should equal fx0)
  maxAbsErr: number; // largest |f - T_n| over the visible range
}

export interface TaylorSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (s: TaylorState) => void;
}

const COLORS = {
  axis: 'rgba(255, 255, 255, 0.22)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axisLabel: 'rgba(255, 255, 255, 0.5)',
  curve: '#00e5ff',
  taylor: '#ffd54f',
  centre: '#ff6b9d',
  centreLine: 'rgba(255, 107, 157, 0.4)',
};

export class TaylorScene extends Canvas2DBase {
  private preset: FunctionPreset;
  private a = 0;
  private n = 3;
  private onUpdate?: (s: TaylorState) => void;

  private xMin = -3;
  private xMax = 3;
  private yMin = -2;
  private yMax = 4;

  private readonly margin = { top: 16, right: 16, bottom: 28, left: 40 };

  constructor(options: TaylorSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    // Default: sin around 0 — classic Taylor demo.
    this.preset = FUNCTION_PRESETS.find((p) => p.id === 'sin' && p.taylor)!;
    this.recalcRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setPreset(id: string): void {
    const next = FUNCTION_PRESETS.find((p) => p.id === id);
    if (!next || !next.taylor) return; // pages should filter, but be defensive
    this.preset = next;
    [this.xMin, this.xMax] = next.range;
    this.a = Math.max(this.xMin, Math.min(this.xMax, this.a));
    this.recalcRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setA(a: number): void {
    this.a = a;
    this.emitUpdate();
    this.scheduleRender();
  }

  public setN(n: number): void {
    this.n = Math.max(0, Math.floor(n));
    this.emitUpdate();
    this.scheduleRender();
  }

  public getXRange(): [number, number] {
    return [this.xMin, this.xMax];
  }

  private recalcRanges(): void {
    if (this.preset.yRange) {
      [this.yMin, this.yMax] = this.preset.yRange;
      // Pad slightly so divergent Taylor tails aren't too clamped.
      const span = this.yMax - this.yMin;
      this.yMin -= span * 0.15;
      this.yMax += span * 0.15;
    } else {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const x = this.xMin + (i / 200) * (this.xMax - this.xMin);
        const y = this.preset.f(x);
        if (Number.isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; }
      }
      const pad = Math.max((hi - lo) * 0.2, 1);
      this.yMin = lo - pad;
      this.yMax = hi + pad;
    }
  }

  /**
   * Evaluate T_n(x; a) = Σ_{k=0..n} c_k(a) · (x - a)^k where c_k comes from
   * the preset's `taylor` coefficient generator.
   */
  private taylor(x: number, a: number, n: number): number {
    const coef = this.preset.taylor;
    if (!coef) return NaN;
    let total = 0;
    let power = 1; // (x - a)^0
    const dx = x - a;
    for (let k = 0; k <= n; k++) {
      total += coef(a, k) * power;
      power *= dx;
    }
    return total;
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const fx0 = this.preset.f(this.a);
    const tnAtA = this.taylor(this.a, this.a, this.n);
    // Sample max abs error across visible range, on a coarse grid.
    let maxErr = 0;
    const samples = 200;
    for (let i = 0; i <= samples; i++) {
      const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
      const fy = this.preset.f(x);
      const ty = this.taylor(x, this.a, this.n);
      if (!Number.isFinite(fy) || !Number.isFinite(ty)) continue;
      const err = Math.abs(fy - ty);
      if (err > maxErr) maxErr = err;
    }
    this.onUpdate({ a: this.a, n: this.n, fx0, tnAtA, maxAbsErr: maxErr });
  }

  private worldToScreen(x: number, y: number): { sx: number; sy: number } {
    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;
    const sx = this.margin.left + ((x - this.xMin) / (this.xMax - this.xMin)) * plotW;
    const sy = this.margin.top + ((this.yMax - y) / (this.yMax - this.yMin)) * plotH;
    return { sx, sy };
  }

  protected draw(): void {
    this.drawAxes();
    this.drawTaylor();
    this.drawCurve();
    this.drawCentre();
  }

  private drawAxes(): void {
    const { ctx } = this;
    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;
    const xStep = niceStep((this.xMax - this.xMin) / 6);
    const yStep = niceStep((this.yMax - this.yMin) / 5);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(this.xMin / xStep) * xStep; x <= this.xMax; x += xStep) {
      const { sx } = this.worldToScreen(x, 0);
      ctx.moveTo(sx, this.margin.top);
      ctx.lineTo(sx, this.margin.top + plotH);
    }
    for (let y = Math.ceil(this.yMin / yStep) * yStep; y <= this.yMax; y += yStep) {
      const { sy } = this.worldToScreen(0, y);
      ctx.moveTo(this.margin.left, sy);
      ctx.lineTo(this.margin.left + plotW, sy);
    }
    ctx.stroke();

    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (this.yMin <= 0 && this.yMax >= 0) {
      const { sy } = this.worldToScreen(0, 0);
      ctx.moveTo(this.margin.left, sy);
      ctx.lineTo(this.margin.left + plotW, sy);
    }
    if (this.xMin <= 0 && this.xMax >= 0) {
      const { sx } = this.worldToScreen(0, 0);
      ctx.moveTo(sx, this.margin.top);
      ctx.lineTo(sx, this.margin.top + plotH);
    }
    ctx.stroke();

    ctx.fillStyle = COLORS.axisLabel;
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(this.xMin / xStep) * xStep; x <= this.xMax; x += xStep) {
      if (Math.abs(x) < xStep / 2) continue;
      const { sx } = this.worldToScreen(x, 0);
      ctx.fillText(formatTick(x), sx, this.margin.top + plotH + 4);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(this.yMin / yStep) * yStep; y <= this.yMax; y += yStep) {
      if (Math.abs(y) < yStep / 2) continue;
      const { sy } = this.worldToScreen(0, y);
      ctx.fillText(formatTick(y), this.margin.left - 4, sy);
    }
  }

  private drawSampledLine(fn: (x: number) => number, color: string, width: number, samples: number): void {
    const { ctx } = this;
    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.margin.left, this.margin.top, plotW, plotH);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let started = false;
    let prevInside = false;
    for (let i = 0; i <= samples; i++) {
      const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
      const y = fn(x);
      const inside = Number.isFinite(y) && y >= this.yMin && y <= this.yMax;
      if (!inside) {
        prevInside = false;
        continue;
      }
      const { sx, sy } = this.worldToScreen(x, y);
      if (!started || !prevInside) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
      prevInside = true;
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawCurve(): void {
    this.drawSampledLine((x) => this.preset.f(x), COLORS.curve, 2.5, 320);
  }

  private drawTaylor(): void {
    this.drawSampledLine((x) => this.taylor(x, this.a, this.n), COLORS.taylor, 2.5, 320);
  }

  private drawCentre(): void {
    const { ctx } = this;
    const y0 = this.preset.f(this.a);
    // Vertical line at a
    ctx.save();
    ctx.strokeStyle = COLORS.centreLine;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    const { sx } = this.worldToScreen(this.a, 0);
    ctx.beginPath();
    ctx.moveTo(sx, this.margin.top);
    ctx.lineTo(sx, this.height - this.margin.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    // Marker dot at (a, f(a))
    if (Number.isFinite(y0)) {
      const { sy } = this.worldToScreen(this.a, y0);
      ctx.fillStyle = COLORS.centre;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.centre;
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('a', sx + 7, sy - 7);
    }
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
