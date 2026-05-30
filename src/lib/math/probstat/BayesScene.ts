import { Canvas2DBase, type Canvas2DBaseOptions } from '../Canvas2DBase';
import { betaPDF } from './mathHelpers';

export interface BayesState {
  priorAlpha: number;
  priorBeta: number;
  heads: number;
  tails: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  priorMean: number;
  posteriorMean: number;
  observedRate: number;
  truePValue: number;
}

export interface BayesSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (state: BayesState) => void;
}

export class BayesScene extends Canvas2DBase {
  private priorAlpha = 2;
  private priorBeta = 2;
  private heads = 0;
  private tails = 0;
  private trueP = 0.7;
  private readonly onUpdate?: (state: BayesState) => void;

  constructor(options: BayesSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── public API

  public setPriorAlpha(v: number): void {
    this.priorAlpha = Math.max(0.5, Math.min(50, v));
    this.emitUpdate();
    this.scheduleRender();
  }

  public setPriorBeta(v: number): void {
    this.priorBeta = Math.max(0.5, Math.min(50, v));
    this.emitUpdate();
    this.scheduleRender();
  }

  public setTrueP(v: number): void {
    this.trueP = Math.max(0, Math.min(1, v));
    this.emitUpdate();
  }

  public addHeads(n: number): void {
    this.heads += n;
    this.emitUpdate();
    this.scheduleRender();
  }

  public addTails(n: number): void {
    this.tails += n;
    this.emitUpdate();
    this.scheduleRender();
  }

  public sampleRandom(n: number): void {
    for (let i = 0; i < n; i++) {
      if (Math.random() < this.trueP) this.heads++;
      else this.tails++;
    }
    this.emitUpdate();
    this.scheduleRender();
  }

  public resetData(): void {
    this.heads = 0;
    this.tails = 0;
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const padL = 56;
    const padR = 24;
    const padT = 18;
    const padB = 34;
    const rect = { x: padL, y: padT, w: w - padL - padR, h: h - padT - padB };
    if (rect.w <= 0 || rect.h <= 0) return;

    const xMin = 0;
    const xMax = 1;

    // Sample both curves
    const N = 240;
    const priorVals: number[] = [];
    const postVals: number[] = [];
    const postA = this.priorAlpha + this.heads;
    const postB = this.priorBeta + this.tails;
    let yMax = 0;
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      const yp = betaPDF(x, this.priorAlpha, this.priorBeta);
      const yq = betaPDF(x, postA, postB);
      priorVals.push(yp);
      postVals.push(yq);
      if (yp > yMax) yMax = yp;
      if (yq > yMax) yMax = yq;
    }
    yMax = yMax * 1.12 || 1;
    if (!Number.isFinite(yMax)) yMax = 8;
    yMax = Math.min(yMax, 30); // Cap to prevent crazy spikes when α, β >> 1

    // Axes
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
      ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
      ctx.fillText(v.toFixed(2), rect.x - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const v = i / xTicks;
      const x = rect.x + v * rect.w;
      ctx.fillText(v.toFixed(2), x, rect.y + rect.h + 4);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.stroke();

    const toX = (x: number) => rect.x + ((x - xMin) / (xMax - xMin)) * rect.w;
    const toY = (y: number) => rect.y + rect.h - Math.min(yMax, Math.max(0, y)) / yMax * rect.h;

    // Prior — dashed faded
    ctx.strokeStyle = 'rgba(38,139,210,0.7)';
    ctx.fillStyle = 'rgba(38,139,210,0.10)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      if (i === 0) ctx.moveTo(toX(x), toY(priorVals[i]));
      else ctx.lineTo(toX(x), toY(priorVals[i]));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Posterior — solid bold
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      if (i === 0) ctx.moveTo(toX(x), toY(postVals[i]));
      else ctx.lineTo(toX(x), toY(postVals[i]));
    }
    ctx.lineTo(toX(1), toY(0));
    ctx.lineTo(toX(0), toY(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(220,50,47,0.18)';
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      if (i === 0) ctx.moveTo(toX(x), toY(postVals[i]));
      else ctx.lineTo(toX(x), toY(postVals[i]));
    }
    ctx.strokeStyle = 'rgba(220,50,47,0.95)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // True p line
    const tpx = toX(this.trueP);
    ctx.strokeStyle = 'rgba(244,162,97,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tpx, rect.y); ctx.lineTo(tpx, rect.y + rect.h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(244,162,97,1)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`真值 p = ${this.trueP.toFixed(2)}`, tpx + 4, rect.y + 4);

    // X-axis title
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('p (硬幣正面機率)', rect.x + rect.w / 2, h - 4);

    // Y-axis title
    ctx.save();
    ctx.translate(14, rect.y + rect.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('機率密度 (Beta PDF)', 0, 0);
    ctx.restore();
  }

  private emitUpdate(): void {
    const postA = this.priorAlpha + this.heads;
    const postB = this.priorBeta + this.tails;
    const total = this.heads + this.tails;
    this.onUpdate?.({
      priorAlpha: this.priorAlpha,
      priorBeta: this.priorBeta,
      heads: this.heads,
      tails: this.tails,
      posteriorAlpha: postA,
      posteriorBeta: postB,
      priorMean: this.priorAlpha / (this.priorAlpha + this.priorBeta),
      posteriorMean: postA / (postA + postB),
      observedRate: total > 0 ? this.heads / total : NaN,
      truePValue: this.trueP,
    });
  }
}
