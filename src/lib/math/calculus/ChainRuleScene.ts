import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import { FUNCTION_PRESETS, type FunctionPreset } from './presets';

/**
 * Side-by-side (vertically stacked) plots of f(x) and (g∘f)(x), sharing the
 * x-axis. Both plots draw a tangent at the same x — top tangent's slope is
 * f'(x), bottom tangent's slope is g'(f(x))·f'(x). Lets the learner see the
 * chain rule as "two slopes multiplying" rather than a formula.
 */
export interface ChainRuleState {
  x: number;
  fx: number;
  fpx: number;
  gfx: number;
  gpfx: number;
  compositeSlope: number;
}

export interface ChainRuleSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (s: ChainRuleState) => void;
}

const COLORS = {
  axis: 'rgba(255, 255, 255, 0.22)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axisLabel: 'rgba(255, 255, 255, 0.5)',
  curve: '#00e5ff',
  tangent: '#ff6b9d',
  point: '#ffffff',
  guide: 'rgba(255, 213, 79, 0.35)',
  titleF: '#00e5ff',
  titleG: '#ffd54f',
};

interface PlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
  yMin: number;
  yMax: number;
}

export class ChainRuleScene extends Canvas2DBase {
  private fPreset: FunctionPreset;
  private gPreset: FunctionPreset;
  private x = 1;
  private onUpdate?: (s: ChainRuleState) => void;

  private xMin = -2;
  private xMax = 2;
  private topYMin = -1;
  private topYMax = 4;
  private bottomYMin = -1;
  private bottomYMax = 1;

  private readonly margin = { top: 14, right: 14, bottom: 22, left: 38 };
  private readonly gap = 24;

  constructor(options: ChainRuleSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.fPreset = FUNCTION_PRESETS.find((p) => p.id === 'parabola')!;
    this.gPreset = FUNCTION_PRESETS.find((p) => p.id === 'sin')!;
    this.recalcRanges();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setFPreset(id: string): void {
    const next = FUNCTION_PRESETS.find((p) => p.id === id);
    if (!next) return;
    this.fPreset = next;
    this.recalcRanges();
    this.x = Math.max(this.xMin, Math.min(this.xMax, this.x));
    this.emitUpdate();
    this.scheduleRender();
  }

  public setGPreset(id: string): void {
    const next = FUNCTION_PRESETS.find((p) => p.id === id);
    if (!next) return;
    this.gPreset = next;
    this.recalcRanges();
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

  private composite(x: number): number {
    return this.gPreset.f(this.fPreset.f(x));
  }

  private compositePrime(x: number): number {
    return this.gPreset.fPrime(this.fPreset.f(x)) * this.fPreset.fPrime(x);
  }

  private recalcRanges(): void {
    [this.xMin, this.xMax] = this.fPreset.range;

    // Sample both functions to set y-ranges (auto-fit, ignoring inf/NaN).
    const samples = 200;
    let fLo = Infinity, fHi = -Infinity, cLo = Infinity, cHi = -Infinity;
    for (let i = 0; i <= samples; i++) {
      const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
      const fv = this.fPreset.f(x);
      const cv = this.composite(x);
      if (Number.isFinite(fv)) { if (fv < fLo) fLo = fv; if (fv > fHi) fHi = fv; }
      if (Number.isFinite(cv)) { if (cv < cLo) cLo = cv; if (cv > cHi) cHi = cv; }
    }
    const padF = Math.max((fHi - fLo) * 0.12, 0.5);
    const padC = Math.max((cHi - cLo) * 0.12, 0.5);
    this.topYMin = fLo - padF;
    this.topYMax = fHi + padF;
    this.bottomYMin = cLo - padC;
    this.bottomYMax = cHi + padC;
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const fx = this.fPreset.f(this.x);
    const fpx = this.fPreset.fPrime(this.x);
    const gfx = this.gPreset.f(fx);
    const gpfx = this.gPreset.fPrime(fx);
    const compositeSlope = gpfx * fpx;
    this.onUpdate({ x: this.x, fx, fpx, gfx, gpfx, compositeSlope });
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
    this.drawSubPlot(this.rectFor('top'), 'f(x)', COLORS.titleF, (x) => this.fPreset.f(x), this.fPreset.fPrime(this.x));
    this.drawSubPlot(this.rectFor('bottom'), '(g ∘ f)(x)', COLORS.titleG, (x) => this.composite(x), this.compositePrime(this.x));
    this.drawSharedXGuide();
  }

  private drawSubPlot(rect: PlotRect, title: string, titleColor: string, fn: (x: number) => number, slopeAtX: number): void {
    const { ctx } = this;

    // Subplot border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    // Title
    ctx.fillStyle = titleColor;
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, rect.x + 8, rect.y + 6);

    this.drawAxesIn(rect);
    this.drawCurveIn(rect, fn);

    // Tangent at current x
    const y0 = fn(this.x);
    if (Number.isFinite(y0) && Number.isFinite(slopeAtX)) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.strokeStyle = COLORS.tangent;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      const yLeft = y0 + slopeAtX * (this.xMin - this.x);
      const yRight = y0 + slopeAtX * (this.xMax - this.x);
      const a = this.worldToScreen(rect, this.xMin, yLeft);
      const b = this.worldToScreen(rect, this.xMax, yRight);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      ctx.restore();
    }

    // Point at (x, fn(x))
    if (Number.isFinite(y0)) {
      const { sx, sy } = this.worldToScreen(rect, this.x, y0);
      ctx.fillStyle = COLORS.point;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
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

    // y=0 and x=0 lines (slightly stronger)
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

    // tick labels
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

  private drawCurveIn(rect: PlotRect, fn: (x: number) => number): void {
    const { ctx } = this;
    const samples = 240;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= samples; i++) {
      const x = this.xMin + (i / samples) * (this.xMax - this.xMin);
      const y = fn(x);
      if (!Number.isFinite(y)) {
        started = false;
        continue;
      }
      const { sx, sy } = this.worldToScreen(rect, x, y);
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawSharedXGuide(): void {
    const { ctx } = this;
    const totalTop = this.margin.top;
    const totalBottom = this.height - this.margin.bottom;
    const topRect = this.rectFor('top');
    const { sx } = this.worldToScreen(topRect, this.x, 0);

    ctx.save();
    ctx.strokeStyle = COLORS.guide;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, totalTop);
    ctx.lineTo(sx, totalBottom);
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
