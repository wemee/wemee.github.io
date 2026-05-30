import { Canvas2DBase, type Canvas2DBaseOptions } from '../Canvas2DBase';
import { randUniform, randExponential, randNormal, normalPDF } from './mathHelpers';

export type LLNCLTMode = 'lln' | 'clt';
export type SourceKind = 'uniform' | 'exponential' | 'dice2' | 'bimodal';

interface SourceInfo {
  label: string;
  mean: number;
  variance: number;
  /** Returns a 1-sample from the source. */
  draw: () => number;
  /** PDF or PMF value at x — for drawing the source curve. */
  density: (x: number) => number;
  isDiscrete: boolean;
  xRange: [number, number];
}

const SOURCES: Record<SourceKind, SourceInfo> = {
  uniform: {
    label: 'U(0, 1)',
    mean: 0.5,
    variance: 1 / 12,
    draw: () => randUniform(0, 1),
    density: (x) => (x >= 0 && x <= 1 ? 1 : 0),
    isDiscrete: false,
    xRange: [-0.1, 1.1],
  },
  exponential: {
    label: 'Exp(1)',
    mean: 1,
    variance: 1,
    draw: () => randExponential(1),
    density: (x) => (x >= 0 ? Math.exp(-x) : 0),
    isDiscrete: false,
    xRange: [0, 5],
  },
  dice2: {
    label: '兩顆骰子加總',
    mean: 7,
    variance: 35 / 6,
    draw: () => Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2,
    density: (x) => {
      const k = Math.round(x);
      if (k < 2 || k > 12) return 0;
      const ways = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
      return ways[k - 2] / 36;
    },
    isDiscrete: true,
    xRange: [1.5, 12.5],
  },
  bimodal: {
    label: '雙峰 (混合常態)',
    mean: 0,
    // Var of mixture = E[Var] + Var[E] = 0.09 + 1 = 1.09
    variance: 1.09,
    draw: () => (Math.random() < 0.5 ? randNormal(-1, 0.3) : randNormal(1, 0.3)),
    density: (x) => 0.5 * normalPDF(x, -1, 0.3) + 0.5 * normalPDF(x, 1, 0.3),
    isDiscrete: false,
    xRange: [-2.5, 2.5],
  },
};

export interface LLNCLTState {
  mode: LLNCLTMode;
  source: SourceKind;
  n: number;
  isRunning: boolean;
  // LLN
  currentN: number;
  currentMean: number;
  // CLT
  numTrials: number;
}

export interface LLNCLTSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (state: LLNCLTState) => void;
}

export class LLNCLTScene extends Canvas2DBase {
  private mode: LLNCLTMode = 'lln';
  private source: SourceKind = 'uniform';
  private n = 30;
  private isRunning = false;
  private rafId: number | null = null;

  // LLN — running mean of samples drawn so far
  private lnnCount = 0;
  private lnnSum = 0;
  /** trace[i] = (n_at_step, runningMean) */
  private trace: { n: number; mean: number }[] = [];

  // CLT — collected sample means (each is mean of `n` source samples)
  private sampleMeans: number[] = [];
  private static readonly MAX_TRIALS = 5000;
  private static readonly MAX_TRACE = 4000;

  private readonly onUpdate?: (state: LLNCLTState) => void;

  constructor(options: LLNCLTSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── public API

  public setMode(mode: LLNCLTMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.resetData();
  }

  public setSource(source: SourceKind): void {
    if (source === this.source) return;
    this.source = source;
    this.resetData();
  }

  public setN(n: number): void {
    n = Math.max(2, Math.min(500, Math.round(n)));
    if (n === this.n) return;
    this.n = n;
    // Only CLT cares about n; reset its data so the histogram matches
    if (this.mode === 'clt') this.resetData();
    else this.emitUpdate();
  }

  public toggleRun(): void {
    if (this.isRunning) this.stop();
    else this.start();
  }

  public reset(): void {
    this.resetData();
  }

  public override destroy(): void {
    this.stop();
    super.destroy();
  }

  // ─────────────────────────────────────────── internals

  private resetData(): void {
    this.stop();
    this.lnnCount = 0;
    this.lnnSum = 0;
    this.trace = [];
    this.sampleMeans = [];
    this.emitUpdate();
    this.scheduleRender();
  }

  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emitUpdate();
    const tick = () => {
      if (!this.isRunning) return;
      if (this.mode === 'lln') this.tickLLN();
      else this.tickCLT();
      this.emitUpdate();
      this.scheduleRender();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.emitUpdate();
  }

  private tickLLN(): void {
    const src = SOURCES[this.source];
    // Scale rate: more samples per frame as n grows so the trace progresses
    // visibly even at high n.
    const stepCount = Math.min(64, 4 + Math.floor(this.lnnCount / 200));
    for (let i = 0; i < stepCount; i++) {
      this.lnnSum += src.draw();
      this.lnnCount++;
    }
    if (this.trace.length < LLNCLTScene.MAX_TRACE) {
      this.trace.push({ n: this.lnnCount, mean: this.lnnSum / this.lnnCount });
    } else {
      // Decimate: drop every other entry, keep latest
      this.trace = this.trace.filter((_, i) => i % 2 === 0);
      this.trace.push({ n: this.lnnCount, mean: this.lnnSum / this.lnnCount });
    }
  }

  private tickCLT(): void {
    const src = SOURCES[this.source];
    // Add ~6 trials per frame so the histogram visibly builds.
    const trialsPerFrame = 6;
    for (let t = 0; t < trialsPerFrame; t++) {
      if (this.sampleMeans.length >= LLNCLTScene.MAX_TRIALS) {
        this.stop();
        return;
      }
      let sum = 0;
      for (let i = 0; i < this.n; i++) sum += src.draw();
      this.sampleMeans.push(sum / this.n);
    }
  }

  private emitUpdate(): void {
    this.onUpdate?.({
      mode: this.mode,
      source: this.source,
      n: this.n,
      isRunning: this.isRunning,
      currentN: this.lnnCount,
      currentMean: this.lnnCount > 0 ? this.lnnSum / this.lnnCount : NaN,
      numTrials: this.sampleMeans.length,
    });
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const gap = 24;
    const padL = 56;
    const padR = 18;
    const topRect = { x: padL, y: 18, w: w - padL - padR, h: (h - gap) / 2 - 18 };
    const botRect = { x: padL, y: topRect.y + topRect.h + gap, w: w - padL - padR, h: (h - gap) / 2 - 18 };
    if (topRect.w <= 0 || topRect.h <= 0) return;

    this.drawSourcePlot(topRect);
    if (this.mode === 'lln') this.drawLLNPlot(botRect);
    else this.drawCLTPlot(botRect);

    // X-axis title under bottom
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      this.mode === 'lln' ? 'n (累計抽樣數)' : '樣本均值',
      botRect.x + botRect.w / 2,
      h - 4,
    );
  }

  private drawAxes(
    rect: { x: number; y: number; w: number; h: number },
    yMax: number,
    xMin: number, xMax: number,
    yLabel: string,
    yIsCount = false,
  ): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = (yMax / yTicks) * i;
      const y = rect.y + rect.h - (v / yMax) * rect.h;
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
      ctx.fillText(yIsCount ? String(Math.round(v)) : v.toFixed(2), rect.x - 6, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const v = xMin + ((xMax - xMin) / xTicks) * i;
      const x = rect.x + ((v - xMin) / (xMax - xMin)) * rect.w;
      ctx.fillText(this.formatTick(v, xMax), x, rect.y + rect.h + 4);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.stroke();

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

  private formatTick(v: number, scale: number): string {
    if (scale >= 1000) return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
    if (scale >= 10) return v.toFixed(0);
    return v.toFixed(2);
  }

  private drawSourcePlot(rect: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    const src = SOURCES[this.source];
    const [xMin, xMax] = src.xRange;

    // Sample source density
    let yMax = 0;
    const samples: { x: number; y: number }[] = [];
    if (src.isDiscrete) {
      const lo = Math.max(0, Math.ceil(xMin));
      const hi = Math.floor(xMax);
      for (let k = lo; k <= hi; k++) {
        const y = src.density(k);
        samples.push({ x: k, y });
        if (y > yMax) yMax = y;
      }
    } else {
      const N = 200;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (i / N) * (xMax - xMin);
        const y = src.density(x);
        samples.push({ x, y });
        if (y > yMax) yMax = y;
      }
    }
    yMax = yMax * 1.15 || 1;

    this.drawAxes(rect, yMax, xMin, xMax, '來源分布');

    const toX = (x: number) => rect.x + ((x - xMin) / (xMax - xMin)) * rect.w;
    const toY = (y: number) => rect.y + rect.h - (y / yMax) * rect.h;

    if (src.isDiscrete) {
      ctx.strokeStyle = 'rgba(38,139,210,0.75)';
      ctx.fillStyle = 'rgba(38,139,210,0.95)';
      ctx.lineWidth = 2;
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
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const xPix = toX(samples[i].x);
        const yPix = toY(samples[i].y);
        if (i === 0) ctx.moveTo(xPix, yPix);
        else ctx.lineTo(xPix, yPix);
      }
      ctx.lineTo(toX(samples[samples.length - 1].x), toY(0));
      ctx.lineTo(toX(samples[0].x), toY(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(38,139,210,0.18)';
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const xPix = toX(samples[i].x);
        const yPix = toY(samples[i].y);
        if (i === 0) ctx.moveTo(xPix, yPix);
        else ctx.lineTo(xPix, yPix);
      }
      ctx.strokeStyle = 'rgba(38,139,210,0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // True mean vertical line
    const mx = toX(src.mean);
    ctx.strokeStyle = 'rgba(244,162,97,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, rect.y);
    ctx.lineTo(mx, rect.y + rect.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(244,162,97,1)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`μ = ${src.mean.toFixed(2)}`, mx + 4, rect.y + 4);
  }

  private drawLLNPlot(rect: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    const src = SOURCES[this.source];
    const trace = this.trace;
    const mu = src.mean;

    const nMax = trace.length > 0 ? Math.max(50, trace[trace.length - 1].n) : 50;
    // Y range: center on true mean, ±2σ initially, shrink toward μ as n grows
    const halfRange = Math.max(2 * Math.sqrt(src.variance) / Math.sqrt(5), 0.5);
    const yMin = mu - halfRange;
    const yMax = mu + halfRange;

    // Manually draw with custom y range
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
      ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
      ctx.fillText(v.toFixed(2), rect.x - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const v = (nMax / xTicks) * i;
      const x = rect.x + (v / nMax) * rect.w;
      ctx.fillText(this.formatTick(v, nMax), x, rect.y + rect.h + 4);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h); ctx.stroke();

    ctx.save();
    ctx.translate(14, rect.y + rect.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('累計樣本均值', 0, 0);
    ctx.restore();

    // True mean horizontal line
    const muY = rect.y + rect.h - ((mu - yMin) / (yMax - yMin)) * rect.h;
    ctx.strokeStyle = 'rgba(244,162,97,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(rect.x, muY); ctx.lineTo(rect.x + rect.w, muY); ctx.stroke();
    ctx.setLineDash([]);

    // Running-mean trace
    if (trace.length > 1) {
      ctx.strokeStyle = 'rgba(133,153,0,0.95)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      // Downsample if too many points: target ~plot width
      const targetPts = Math.min(trace.length, Math.floor(rect.w));
      const stride = Math.max(1, Math.floor(trace.length / targetPts));
      for (let i = 0; i < trace.length; i += stride) {
        const p = trace[i];
        const xPix = rect.x + (p.n / nMax) * rect.w;
        const yClamped = Math.max(yMin, Math.min(yMax, p.mean));
        const yPix = rect.y + rect.h - ((yClamped - yMin) / (yMax - yMin)) * rect.h;
        if (i === 0) ctx.moveTo(xPix, yPix);
        else ctx.lineTo(xPix, yPix);
      }
      // Always include last point
      const last = trace[trace.length - 1];
      const xPix = rect.x + (last.n / nMax) * rect.w;
      const yClamped = Math.max(yMin, Math.min(yMax, last.mean));
      const yPix = rect.y + rect.h - ((yClamped - yMin) / (yMax - yMin)) * rect.h;
      ctx.lineTo(xPix, yPix);
      ctx.stroke();
    }
  }

  private drawCLTPlot(rect: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    const src = SOURCES[this.source];
    const mu = src.mean;
    const sigmaMean = Math.sqrt(src.variance / this.n); // theoretical SD of sample mean

    // X-range: center on μ, ±4 σ/√n  (clamped to source range minimally)
    const halfRange = Math.max(4 * sigmaMean, 0.05);
    const xMin = mu - halfRange;
    const xMax = mu + halfRange;

    // Bin sample means
    const numBins = 30;
    const binW = (xMax - xMin) / numBins;
    const counts = new Array(numBins).fill(0);
    for (const m of this.sampleMeans) {
      if (m < xMin || m >= xMax) continue;
      const b = Math.min(numBins - 1, Math.floor((m - xMin) / binW));
      counts[b]++;
    }
    const total = this.sampleMeans.length;
    // Convert to densities so it's comparable to the normal overlay
    const densities = counts.map((c) => (total > 0 ? c / (total * binW) : 0));
    const theoMax = total > 0 ? normalPDF(mu, mu, sigmaMean) : 1;
    const yMax = Math.max(theoMax * 1.15, ...densities, 0.5);

    this.drawAxes(rect, yMax, xMin, xMax, '樣本均值密度');

    const toX = (x: number) => rect.x + ((x - xMin) / (xMax - xMin)) * rect.w;
    const toY = (y: number) => rect.y + rect.h - (y / yMax) * rect.h;

    // Histogram bars
    ctx.fillStyle = 'rgba(133,153,0,0.65)';
    ctx.strokeStyle = 'rgba(133,153,0,0.95)';
    ctx.lineWidth = 1;
    for (let i = 0; i < numBins; i++) {
      if (densities[i] <= 0) continue;
      const x0 = toX(xMin + i * binW);
      const x1 = toX(xMin + (i + 1) * binW);
      const y = toY(densities[i]);
      ctx.fillRect(x0, y, x1 - x0, toY(0) - y);
      ctx.strokeRect(x0, y, x1 - x0, toY(0) - y);
    }

    // Theoretical normal overlay
    if (total > 0) {
      ctx.beginPath();
      const N = 200;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (i / N) * (xMax - xMin);
        const y = normalPDF(x, mu, sigmaMean);
        if (i === 0) ctx.moveTo(toX(x), toY(y));
        else ctx.lineTo(toX(x), toY(y));
      }
      ctx.strokeStyle = 'rgba(220,50,47,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // μ line
    const mx = toX(mu);
    ctx.strokeStyle = 'rgba(244,162,97,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, rect.y); ctx.lineTo(mx, rect.y + rect.h); ctx.stroke();
    ctx.setLineDash([]);
  }
}
