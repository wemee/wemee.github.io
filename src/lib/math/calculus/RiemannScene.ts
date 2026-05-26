import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import { FUNCTION_PRESETS, type FunctionPreset } from './presets';

export type RiemannMode = 'left' | 'mid' | 'right';

export interface RiemannState {
  a: number;
  b: number;
  n: number;
  mode: RiemannMode;
  approx: number;
  truth: number;
  error: number;
}

export interface RiemannSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (s: RiemannState) => void;
}

const COLORS = {
  axis: 'rgba(255, 255, 255, 0.22)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axisLabel: 'rgba(255, 255, 255, 0.5)',
  curve: '#00e5ff',
  rectFillPos: 'rgba(255, 213, 79, 0.30)',
  rectFillNeg: 'rgba(255, 107, 157, 0.30)',
  rectStroke: 'rgba(255, 213, 79, 0.7)',
  rectStrokeNeg: 'rgba(255, 107, 157, 0.7)',
};

/**
 * High-N midpoint rule used as ground truth. 10000 sub-intervals gives error
 * well below display precision for the supplied smooth presets.
 */
const TRUTH_N = 10000;

export class RiemannScene extends Canvas2DBase {
  private preset: FunctionPreset;
  private a = -1;
  private b = 1;
  private n = 8;
  private mode: RiemannMode = 'mid';
  private onUpdate?: (s: RiemannState) => void;

  // Plot ranges (x follows [a,b] with padding; y auto-fits).
  private xMin = -3;
  private xMax = 3;
  private yMin = -1;
  private yMax = 9;

  private readonly margin = { top: 16, right: 16, bottom: 28, left: 40 };

  constructor(options: RiemannSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.preset = FUNCTION_PRESETS.find((p) => p.id === 'parabola')!;
    this.recalcRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setPreset(id: string): void {
    const next = FUNCTION_PRESETS.find((p) => p.id === id);
    if (!next) return;
    this.preset = next;
    [this.a, this.b] = next.range;
    // Pull bounds a bit toward centre so n=4 doesn't blow up domain.
    const mid = (this.a + this.b) / 2;
    const half = (this.b - this.a) / 2 * 0.6;
    this.a = mid - half;
    this.b = mid + half;
    this.recalcRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setBounds(a: number, b: number): void {
    if (a >= b) return;
    this.a = a;
    this.b = b;
    this.recalcRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setN(n: number): void {
    this.n = Math.max(1, Math.floor(n));
    this.emitUpdate();
    this.scheduleRender();
  }

  public setMode(m: RiemannMode): void {
    this.mode = m;
    this.emitUpdate();
    this.scheduleRender();
  }

  public getPresetRange(): [number, number] {
    return this.preset.range;
  }

  private recalcRanges(): void {
    // Pad x-view 15% beyond [a,b], but never past preset's own range.
    const [pLo, pHi] = this.preset.range;
    const pad = (this.b - this.a) * 0.15;
    this.xMin = Math.max(pLo, this.a - pad);
    this.xMax = Math.min(pHi, this.b + pad);

    if (this.preset.yRange) {
      [this.yMin, this.yMax] = this.preset.yRange;
    } else {
      let lo = Infinity, hi = -Infinity;
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
        const y = this.preset.f(x);
        if (Number.isFinite(y)) {
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }
      const pad2 = Math.max((hi - lo) * 0.12, 0.5);
      this.yMin = Math.min(0, lo - pad2);
      this.yMax = Math.max(0, hi + pad2);
    }
  }

  private worldToScreen(x: number, y: number): { sx: number; sy: number } {
    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;
    const sx = this.margin.left + ((x - this.xMin) / (this.xMax - this.xMin)) * plotW;
    const sy = this.margin.top + ((this.yMax - y) / (this.yMax - this.yMin)) * plotH;
    return { sx, sy };
  }

  /**
   * Compute the Riemann sum for `n` rectangles using the chosen sample point
   * mode. Returns `NaN` if any sample fell on a non-finite branch (e.g. near
   * the pole of 1/(1-x)).
   */
  private riemannSum(): number {
    const dx = (this.b - this.a) / this.n;
    let total = 0;
    for (let i = 0; i < this.n; i++) {
      let sample: number;
      if (this.mode === 'left') sample = this.a + i * dx;
      else if (this.mode === 'right') sample = this.a + (i + 1) * dx;
      else sample = this.a + (i + 0.5) * dx;
      const y = this.preset.f(sample);
      if (!Number.isFinite(y)) return NaN;
      total += y * dx;
    }
    return total;
  }

  private trueIntegral(): number {
    const dx = (this.b - this.a) / TRUTH_N;
    let total = 0;
    for (let i = 0; i < TRUTH_N; i++) {
      const sample = this.a + (i + 0.5) * dx;
      const y = this.preset.f(sample);
      if (!Number.isFinite(y)) return NaN;
      total += y * dx;
    }
    return total;
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const approx = this.riemannSum();
    const truth = this.trueIntegral();
    const error = Number.isFinite(approx) && Number.isFinite(truth) ? Math.abs(approx - truth) : NaN;
    this.onUpdate({ a: this.a, b: this.b, n: this.n, mode: this.mode, approx, truth, error });
  }

  protected draw(): void {
    this.drawAxes();
    this.drawRectangles();
    this.drawCurve();
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

  private drawRectangles(): void {
    const { ctx } = this;
    const dx = (this.b - this.a) / this.n;
    const baseY = this.worldToScreen(0, 0).sy;

    for (let i = 0; i < this.n; i++) {
      const xLeft = this.a + i * dx;
      const xRight = xLeft + dx;
      let sampleX: number;
      if (this.mode === 'left') sampleX = xLeft;
      else if (this.mode === 'right') sampleX = xRight;
      else sampleX = xLeft + dx / 2;
      const yVal = this.preset.f(sampleX);
      if (!Number.isFinite(yVal)) continue;

      const tl = this.worldToScreen(xLeft, yVal);
      const tr = this.worldToScreen(xRight, yVal);
      const top = Math.min(tl.sy, baseY);
      const height = Math.abs(tl.sy - baseY);
      const positive = yVal >= 0;

      ctx.fillStyle = positive ? COLORS.rectFillPos : COLORS.rectFillNeg;
      ctx.strokeStyle = positive ? COLORS.rectStroke : COLORS.rectStrokeNeg;
      ctx.lineWidth = 1;
      ctx.fillRect(tl.sx, top, tr.sx - tl.sx, height);
      ctx.strokeRect(tl.sx + 0.5, top + 0.5, tr.sx - tl.sx - 1, height - 1);
    }
  }

  private drawCurve(): void {
    const { ctx } = this;
    const samples = 320;
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= samples; i++) {
      const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
      const y = this.preset.f(x);
      if (!Number.isFinite(y) || y < this.yMin || y > this.yMax) {
        started = false;
        continue;
      }
      const { sx, sy } = this.worldToScreen(x, y);
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
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
