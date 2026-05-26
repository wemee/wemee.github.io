import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import { FUNCTION_PRESETS, type FunctionPreset } from './presets';

/**
 * State emitted to onUpdate after every change. The page binds these
 * numbers to its readout chips so the secant/tangent comparison stays
 * in sync with the canvas.
 */
export interface SlopeTangentState {
  x0: number;
  h: number;
  fx0: number;
  fxh: number;
  secantSlope: number;
  tangentSlope: number;
  error: number;
}

export interface SlopeTangentSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (s: SlopeTangentState) => void;
}

const COLORS = {
  axis: 'rgba(255, 255, 255, 0.22)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axisLabel: 'rgba(255, 255, 255, 0.45)',
  curve: '#00e5ff',     // cyan
  secant: '#ffd54f',    // yellow
  tangent: '#ff6b9d',   // magenta-ish
  point: '#ffffff',
};

export class SlopeTangentScene extends Canvas2DBase {
  private preset: FunctionPreset;
  private x0 = 0.5;
  private h = 1;
  private onUpdate?: (s: SlopeTangentState) => void;

  // Cached world ranges (updated when preset changes).
  private xMin = -3;
  private xMax = 3;
  private yMin = -1;
  private yMax = 9;

  // Plot margins (CSS pixels). Leaves room for tick labels.
  private readonly margin = { top: 16, right: 16, bottom: 28, left: 40 };

  constructor(options: SlopeTangentSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.preset = FUNCTION_PRESETS[0]; // parabola
    this.applyPresetRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setPreset(id: string): void {
    const next = FUNCTION_PRESETS.find((p) => p.id === id);
    if (!next) return;
    this.preset = next;
    this.applyPresetRanges();
    // Clamp x0 into new range if needed.
    this.x0 = Math.max(this.xMin, Math.min(this.xMax, this.x0));
    this.emitUpdate();
    this.scheduleRender();
  }

  public setX0(x: number): void {
    this.x0 = x;
    this.emitUpdate();
    this.scheduleRender();
  }

  public setH(h: number): void {
    this.h = h;
    this.emitUpdate();
    this.scheduleRender();
  }

  public getPresetRange(): [number, number] {
    return [this.xMin, this.xMax];
  }

  private applyPresetRanges(): void {
    [this.xMin, this.xMax] = this.preset.range;
    if (this.preset.yRange) {
      [this.yMin, this.yMax] = this.preset.yRange;
    } else {
      // Auto-fit y from sampled function values.
      let lo = Infinity;
      let hi = -Infinity;
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
        const y = this.preset.f(x);
        if (Number.isFinite(y)) {
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }
      const pad = (hi - lo) * 0.1 || 1;
      this.yMin = lo - pad;
      this.yMax = hi + pad;
    }
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const fx0 = this.preset.f(this.x0);
    const fxh = this.preset.f(this.x0 + this.h);
    const secantSlope = this.h === 0 ? NaN : (fxh - fx0) / this.h;
    const tangentSlope = this.preset.fPrime(this.x0);
    const error = Number.isFinite(secantSlope) ? Math.abs(secantSlope - tangentSlope) : NaN;
    this.onUpdate({ x0: this.x0, h: this.h, fx0, fxh, secantSlope, tangentSlope, error });
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
    this.drawCurve();
    this.drawSecantLine();
    this.drawTangentLine();
    this.drawPoints();
  }

  private drawAxes(): void {
    const { ctx } = this;
    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;

    // Tick step heuristic — aim for ~6 ticks across each axis.
    const xStep = niceStep((this.xMax - this.xMin) / 6);
    const yStep = niceStep((this.yMax - this.yMin) / 6);

    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = COLORS.axisLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Vertical gridlines + x labels
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(this.xMin / xStep) * xStep; x <= this.xMax; x += xStep) {
      const { sx } = this.worldToScreen(x, 0);
      ctx.moveTo(sx, this.margin.top);
      ctx.lineTo(sx, this.margin.top + plotH);
    }
    ctx.stroke();

    // Horizontal gridlines + y labels
    ctx.beginPath();
    for (let y = Math.ceil(this.yMin / yStep) * yStep; y <= this.yMax; y += yStep) {
      const { sy } = this.worldToScreen(0, y);
      ctx.moveTo(this.margin.left, sy);
      ctx.lineTo(this.margin.left + plotW, sy);
    }
    ctx.stroke();

    // Axis lines (origin axes drawn darker; clipped to plot area)
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

    // x tick labels
    for (let x = Math.ceil(this.xMin / xStep) * xStep; x <= this.xMax; x += xStep) {
      if (Math.abs(x) < xStep / 2) continue; // skip 0 label
      const { sx } = this.worldToScreen(x, 0);
      ctx.fillText(formatTick(x), sx, this.margin.top + plotH + 4);
    }

    // y tick labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(this.yMin / yStep) * yStep; y <= this.yMax; y += yStep) {
      if (Math.abs(y) < yStep / 2) continue;
      const { sy } = this.worldToScreen(0, y);
      ctx.fillText(formatTick(y), this.margin.left - 4, sy);
    }
  }

  private drawCurve(): void {
    const { ctx } = this;
    const samples = 300;
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    let prevInside = false;
    for (let i = 0; i <= samples; i++) {
      const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
      const y = this.preset.f(x);
      if (!Number.isFinite(y) || y < this.yMin || y > this.yMax) {
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
  }

  /**
   * Extend a line of slope `m` passing through (x0, y0) across the plot
   * area, then stroke it. Used for both secant and tangent renderings.
   */
  private strokeLineThrough(x0: number, y0: number, m: number, color: string, dash: number[] = []): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);

    // Clip to plot rect so lines don't bleed into margins.
    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;
    ctx.beginPath();
    ctx.rect(this.margin.left, this.margin.top, plotW, plotH);
    ctx.clip();

    const yLeft = y0 + m * (this.xMin - x0);
    const yRight = y0 + m * (this.xMax - x0);
    const a = this.worldToScreen(this.xMin, yLeft);
    const b = this.worldToScreen(this.xMax, yRight);

    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();

    ctx.restore();
  }

  private drawSecantLine(): void {
    if (this.h === 0) return;
    const y0 = this.preset.f(this.x0);
    const yh = this.preset.f(this.x0 + this.h);
    if (!Number.isFinite(y0) || !Number.isFinite(yh)) return;
    const m = (yh - y0) / this.h;
    this.strokeLineThrough(this.x0, y0, m, COLORS.secant);
  }

  private drawTangentLine(): void {
    const y0 = this.preset.f(this.x0);
    if (!Number.isFinite(y0)) return;
    const m = this.preset.fPrime(this.x0);
    this.strokeLineThrough(this.x0, y0, m, COLORS.tangent, [6, 4]);
  }

  private drawPoints(): void {
    const { ctx } = this;
    const y0 = this.preset.f(this.x0);
    const yh = this.preset.f(this.x0 + this.h);

    const drawDot = (x: number, y: number, label: string, anchorRight: boolean) => {
      if (!Number.isFinite(y)) return;
      const { sx, sy } = this.worldToScreen(x, y);
      ctx.fillStyle = COLORS.point;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = anchorRight ? 'left' : 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, sx + (anchorRight ? 8 : -8), sy - 6);
    };

    drawDot(this.x0, y0, 'P', false);
    if (this.h !== 0) drawDot(this.x0 + this.h, yh, 'Q', true);
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
  // Round display to 2 decimals max; strip trailing zeros.
  const s = v.toFixed(2);
  return s.replace(/\.?0+$/, '');
}
