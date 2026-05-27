import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import {
  normalPDF, normalCDF,
  binomialPMF, binomialCDF,
  poissonPMF, poissonCDF,
  exponentialPDF, exponentialCDF,
  uniformPDF, uniformCDF,
} from './mathHelpers';

export type DistributionKind = 'normal' | 'binomial' | 'poisson' | 'exponential' | 'uniform';

export interface DistributionParams {
  // Normal
  mu: number;
  sigma: number;
  // Binomial
  n: number;
  p: number;
  // Poisson
  lambdaPois: number;
  // Exponential
  lambdaExp: number;
  // Uniform
  a: number;
  b: number;
}

export interface DistributionState {
  kind: DistributionKind;
  params: DistributionParams;
  mean: number;
  variance: number;
  isDiscrete: boolean;
}

export interface DistributionSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (state: DistributionState) => void;
}

const DISCRETE: Set<DistributionKind> = new Set(['binomial', 'poisson']);

export class DistributionScene extends Canvas2DBase {
  private kind: DistributionKind = 'normal';
  private params: DistributionParams = {
    mu: 0, sigma: 1,
    n: 20, p: 0.4,
    lambdaPois: 4,
    lambdaExp: 1,
    a: 0, b: 2,
  };
  private readonly onUpdate?: (state: DistributionState) => void;

  constructor(options: DistributionSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── public API

  public setKind(kind: DistributionKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.emitUpdate();
    this.scheduleRender();
  }

  public setParam<K extends keyof DistributionParams>(key: K, value: DistributionParams[K]): void {
    this.params = { ...this.params, [key]: value };
    // Enforce a < b for uniform
    if (this.kind === 'uniform' && this.params.a >= this.params.b) {
      if (key === 'a') this.params = { ...this.params, a: this.params.b - 0.1 };
      if (key === 'b') this.params = { ...this.params, b: this.params.a + 0.1 };
    }
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── distribution functions

  private pdfOrPMF(x: number): number {
    const p = this.params;
    switch (this.kind) {
      case 'normal':       return normalPDF(x, p.mu, p.sigma);
      case 'binomial':     return binomialPMF(Math.round(x), p.n, p.p);
      case 'poisson':      return poissonPMF(Math.round(x), p.lambdaPois);
      case 'exponential':  return exponentialPDF(x, p.lambdaExp);
      case 'uniform':      return uniformPDF(x, p.a, p.b);
    }
  }

  private cdf(x: number): number {
    const p = this.params;
    switch (this.kind) {
      case 'normal':       return normalCDF(x, p.mu, p.sigma);
      case 'binomial':     return binomialCDF(Math.floor(x), p.n, p.p);
      case 'poisson':      return poissonCDF(Math.floor(x), p.lambdaPois);
      case 'exponential':  return exponentialCDF(x, p.lambdaExp);
      case 'uniform':      return uniformCDF(x, p.a, p.b);
    }
  }

  private xRange(): [number, number] {
    const p = this.params;
    switch (this.kind) {
      case 'normal':       return [p.mu - 4 * p.sigma, p.mu + 4 * p.sigma];
      case 'binomial':     return [-0.5, p.n + 0.5];
      case 'poisson':      return [-0.5, Math.max(8, p.lambdaPois + 4 * Math.sqrt(p.lambdaPois))];
      case 'exponential':  return [0, 6 / p.lambdaExp];
      case 'uniform':      return [Math.min(p.a, 0) - 0.5, p.b + 0.5];
    }
  }

  private stats(): { mean: number; variance: number } {
    const p = this.params;
    switch (this.kind) {
      case 'normal':       return { mean: p.mu, variance: p.sigma * p.sigma };
      case 'binomial':     return { mean: p.n * p.p, variance: p.n * p.p * (1 - p.p) };
      case 'poisson':      return { mean: p.lambdaPois, variance: p.lambdaPois };
      case 'exponential':  return { mean: 1 / p.lambdaExp, variance: 1 / (p.lambdaExp * p.lambdaExp) };
      case 'uniform': {
        const m = (p.a + p.b) / 2;
        const v = (p.b - p.a) ** 2 / 12;
        return { mean: m, variance: v };
      }
    }
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const isDiscrete = DISCRETE.has(this.kind);

    const gap = 24;
    const topRect = { x: 56, y: 18, w: w - 56 - 18, h: (h - gap) / 2 - 18 };
    const botRect = { x: 56, y: topRect.y + topRect.h + gap, w: w - 56 - 18, h: (h - gap) / 2 - 18 };
    if (topRect.w <= 0 || topRect.h <= 0) return;

    const [xMin, xMax] = this.xRange();

    // Compute PDF/PMF samples
    let yMaxPDF = 0;
    let topSamples: { x: number; y: number }[] = [];
    if (isDiscrete) {
      const lo = Math.max(0, Math.ceil(xMin));
      const hi = Math.floor(xMax);
      for (let k = lo; k <= hi; k++) {
        const y = this.pdfOrPMF(k);
        topSamples.push({ x: k, y });
        if (y > yMaxPDF) yMaxPDF = y;
      }
    } else {
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (i / N) * (xMax - xMin);
        const y = this.pdfOrPMF(x);
        topSamples.push({ x, y });
        if (y > yMaxPDF) yMaxPDF = y;
      }
    }
    const yMaxTop = yMaxPDF * 1.15 || 1;

    this.drawPlot(topRect, '機率密度 / 質量', xMin, xMax, 0, yMaxTop, () => {
      this.drawTopCurve(topRect, isDiscrete, topSamples, xMin, xMax, yMaxTop);
      this.drawMeanLine(topRect, xMin, xMax, 0, yMaxTop);
    });

    this.drawPlot(botRect, '累積分布 (CDF)', xMin, xMax, 0, 1.05, () => {
      this.drawCDFCurve(botRect, isDiscrete, xMin, xMax);
      this.drawMeanLine(botRect, xMin, xMax, 0, 1.05);
    });

    // X-axis title (centred under bottom plot)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('x', botRect.x + botRect.w / 2, h - 4);
  }

  private drawPlot(
    rect: { x: number; y: number; w: number; h: number },
    yLabel: string,
    xMin: number, xMax: number,
    yMin: number, yMax: number,
    drawBody: () => void,
  ): void {
    const ctx = this.ctx;

    // Grid + Y labels
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + ((yMax - yMin) / yTicks) * i;
      const y = rect.y + rect.h - ((v - yMin) / (yMax - yMin)) * rect.h;
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(2), rect.x - 6, y);
    }

    // X tick labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const v = xMin + ((xMax - xMin) / xTicks) * i;
      const x = rect.x + ((v - xMin) / (xMax - xMin)) * rect.w;
      ctx.fillText(v.toFixed(1), x, rect.y + rect.h + 4);
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.stroke();

    drawBody();

    // Y-axis title (rotated)
    ctx.save();
    ctx.translate(14, rect.y + rect.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  private drawTopCurve(
    rect: { x: number; y: number; w: number; h: number },
    isDiscrete: boolean,
    samples: { x: number; y: number }[],
    xMin: number, xMax: number,
    yMax: number,
  ): void {
    const ctx = this.ctx;
    const toX = (x: number) => rect.x + ((x - xMin) / (xMax - xMin)) * rect.w;
    const toY = (y: number) => rect.y + rect.h - (y / yMax) * rect.h;

    if (isDiscrete) {
      // Stems + tops
      ctx.strokeStyle = 'rgba(38,139,210,0.75)';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(38,139,210,0.95)';
      for (const s of samples) {
        const xPix = toX(s.x);
        const yPix = toY(s.y);
        ctx.beginPath();
        ctx.moveTo(xPix, toY(0));
        ctx.lineTo(xPix, yPix);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(xPix, yPix, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Continuous curve + soft fill
      ctx.beginPath();
      let started = false;
      for (const s of samples) {
        const xPix = toX(s.x);
        const yPix = toY(s.y);
        if (!Number.isFinite(yPix)) { started = false; continue; }
        if (!started) { ctx.moveTo(xPix, yPix); started = true; }
        else ctx.lineTo(xPix, yPix);
      }
      // Close along baseline for fill
      ctx.lineTo(toX(samples[samples.length - 1].x), toY(0));
      ctx.lineTo(toX(samples[0].x), toY(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(38,139,210,0.18)';
      ctx.fill();

      ctx.beginPath();
      started = false;
      for (const s of samples) {
        const xPix = toX(s.x);
        const yPix = toY(s.y);
        if (!Number.isFinite(yPix)) { started = false; continue; }
        if (!started) { ctx.moveTo(xPix, yPix); started = true; }
        else ctx.lineTo(xPix, yPix);
      }
      ctx.strokeStyle = 'rgba(38,139,210,0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawCDFCurve(
    rect: { x: number; y: number; w: number; h: number },
    isDiscrete: boolean,
    xMin: number, xMax: number,
  ): void {
    const ctx = this.ctx;
    const toX = (x: number) => rect.x + ((x - xMin) / (xMax - xMin)) * rect.w;
    const toY = (y: number) => rect.y + rect.h - y * rect.h / 1.05;

    ctx.strokeStyle = 'rgba(133,153,0,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (isDiscrete) {
      // Step function
      let prevY = 0;
      const lo = Math.max(0, Math.ceil(xMin));
      const hi = Math.floor(xMax);
      ctx.moveTo(toX(xMin), toY(0));
      ctx.lineTo(toX(lo), toY(0));
      for (let k = lo; k <= hi; k++) {
        const y = this.cdf(k);
        // Horizontal then jump up
        ctx.lineTo(toX(k), toY(prevY));
        ctx.lineTo(toX(k), toY(y));
        prevY = y;
      }
      // Trail to xMax
      ctx.lineTo(toX(xMax), toY(prevY));
    } else {
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (i / N) * (xMax - xMin);
        const y = this.cdf(x);
        const xPix = toX(x);
        const yPix = toY(y);
        if (i === 0) ctx.moveTo(xPix, yPix);
        else ctx.lineTo(xPix, yPix);
      }
    }
    ctx.stroke();
  }

  private drawMeanLine(
    rect: { x: number; y: number; w: number; h: number },
    xMin: number, xMax: number,
    _yMin: number, _yMax: number,
  ): void {
    const { mean } = this.stats();
    if (mean < xMin || mean > xMax) return;
    const x = rect.x + ((mean - xMin) / (xMax - xMin)) * rect.w;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(244,162,97,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, rect.y);
    ctx.lineTo(x, rect.y + rect.h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ─────────────────────────────────────────── state emit

  private emitUpdate(): void {
    const { mean, variance } = this.stats();
    this.onUpdate?.({
      kind: this.kind,
      params: { ...this.params },
      mean, variance,
      isDiscrete: DISCRETE.has(this.kind),
    });
  }
}
