import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import { randNormal } from './mathHelpers';

export interface MLEPoint { x: number; y: number; }

export interface MLEState {
  points: MLEPoint[];
  noiseSigma: number;
  mleIntercept: number; // β₀̂
  mleSlope: number;     // β₁̂
  mleNLL: number;
  trueIntercept: number;
  trueSlope: number;
}

const TRUE_INTERCEPT = 0.5;
const TRUE_SLOPE = 1.4;
const X_RANGE: [number, number] = [-2, 2];
const Y_RANGE: [number, number] = [-4, 4];

/**
 * Pure-data shared model for the two MLE canvas scenes (scatter + contour).
 * MLE for 1D linear regression has a closed form (OLS) — no optimizer needed.
 */
export class MLEModel {
  private listeners: ((s: MLEState) => void)[] = [];
  public points: MLEPoint[] = [];
  public noiseSigma = 0.6;

  constructor() {
    this.regenerate();
  }

  public onChange(fn: (s: MLEState) => void): () => void {
    this.listeners.push(fn);
    fn(this.snapshot());
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  public regenerate(): void {
    this.points = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const x = X_RANGE[0] + ((X_RANGE[1] - X_RANGE[0]) * (i + 0.5)) / n;
      const y = TRUE_INTERCEPT + TRUE_SLOPE * x + randNormal(0, this.noiseSigma);
      this.points.push({ x, y });
    }
    this.notify();
  }

  public setNoiseSigma(sigma: number): void {
    this.noiseSigma = Math.max(0.05, Math.min(2, sigma));
    // Don't auto-regenerate — let user click button.
    this.notify();
  }

  public setPointY(i: number, y: number): void {
    if (i < 0 || i >= this.points.length) return;
    this.points = this.points.map((p, idx) => (idx === i ? { x: p.x, y } : p));
    this.notify();
  }

  public mle(): { intercept: number; slope: number } {
    const n = this.points.length;
    if (n === 0) return { intercept: 0, slope: 0 };
    const mx = this.points.reduce((s, p) => s + p.x, 0) / n;
    const my = this.points.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0, sxy = 0;
    for (const p of this.points) {
      sxx += (p.x - mx) ** 2;
      sxy += (p.x - mx) * (p.y - my);
    }
    if (sxx === 0) return { intercept: my, slope: 0 };
    const slope = sxy / sxx;
    return { intercept: my - slope * mx, slope };
  }

  public nll(intercept: number, slope: number): number {
    let s = 0;
    for (const p of this.points) {
      const resid = p.y - intercept - slope * p.x;
      s += resid * resid;
    }
    return s;
  }

  private snapshot(): MLEState {
    const { intercept, slope } = this.mle();
    return {
      points: this.points.map((p) => ({ ...p })),
      noiseSigma: this.noiseSigma,
      mleIntercept: intercept,
      mleSlope: slope,
      mleNLL: this.nll(intercept, slope),
      trueIntercept: TRUE_INTERCEPT,
      trueSlope: TRUE_SLOPE,
    };
  }

  private notify(): void {
    const s = this.snapshot();
    for (const l of this.listeners) l(s);
  }
}

// ─────────────────────────────────────────── scatter

export interface MLEScatterOptions extends Canvas2DBaseOptions {
  model: MLEModel;
}

export class MLEScatterScene extends Canvas2DBase {
  private readonly model: MLEModel;
  private unsubscribe: () => void;
  private draggingIdx: number | null = null;
  private pointPixelRadius = 10;

  constructor(options: MLEScatterOptions) {
    super(options);
    this.model = options.model;
    this.unsubscribe = this.model.onChange(() => this.scheduleRender());

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'default';
  }

  public override destroy(): void {
    this.unsubscribe();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    super.destroy();
  }

  private plotRect(): { x: number; y: number; w: number; h: number } {
    return { x: 48, y: 14, w: this.width - 48 - 14, h: this.height - 14 - 28 };
  }

  private toScreen(p: { x: number; y: number }): { x: number; y: number } {
    const r = this.plotRect();
    return {
      x: r.x + ((p.x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * r.w,
      y: r.y + r.h - ((p.y - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * r.h,
    };
  }

  private toWorld(px: number, py: number): { x: number; y: number } {
    const r = this.plotRect();
    return {
      x: X_RANGE[0] + ((px - r.x) / r.w) * (X_RANGE[1] - X_RANGE[0]),
      y: Y_RANGE[0] + ((r.y + r.h - py) / r.h) * (Y_RANGE[1] - Y_RANGE[0]),
    };
  }

  private getPointer(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private findHit(px: number, py: number): number | null {
    let best = -1;
    let bestDist = this.pointPixelRadius;
    this.model.points.forEach((p, i) => {
      const s = this.toScreen(p);
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best >= 0 ? best : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.getPointer(e);
    const hit = this.findHit(x, y);
    if (hit !== null) {
      this.draggingIdx = hit;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const { x, y } = this.getPointer(e);
    if (this.draggingIdx !== null) {
      const w = this.toWorld(x, y);
      const clamped = Math.max(Y_RANGE[0], Math.min(Y_RANGE[1], w.y));
      this.model.setPointY(this.draggingIdx, clamped);
      e.preventDefault();
    } else {
      const hit = this.findHit(x, y);
      this.canvas.style.cursor = hit !== null ? 'grab' : 'default';
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.draggingIdx !== null) {
      this.canvas.releasePointerCapture(e.pointerId);
      this.draggingIdx = null;
      this.canvas.style.cursor = 'default';
    }
  };

  protected draw(): void {
    const ctx = this.ctx;
    const r = this.plotRect();

    // Grid + axes
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = Y_RANGE[0] + ((Y_RANGE[1] - Y_RANGE[0]) / yTicks) * i;
      const y = r.y + r.h - ((v - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * r.h;
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
      ctx.fillText(v.toFixed(1), r.x - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const v = X_RANGE[0] + ((X_RANGE[1] - X_RANGE[0]) / xTicks) * i;
      const x = r.x + ((v - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * r.w;
      ctx.fillText(v.toFixed(1), x, r.y + r.h + 4);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.h);
    ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke();

    // True line (faint)
    const drawLine = (b0: number, b1: number, color: string, lineW = 2, dash: number[] = []) => {
      const p1 = this.toScreen({ x: X_RANGE[0], y: b0 + b1 * X_RANGE[0] });
      const p2 = this.toScreen({ x: X_RANGE[1], y: b0 + b1 * X_RANGE[1] });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawLine(TRUE_INTERCEPT, TRUE_SLOPE, 'rgba(244,162,97,0.7)', 1.5, [5, 4]);
    const { intercept, slope } = this.model.mle();

    // Residual segments (dotted)
    ctx.strokeStyle = 'rgba(220,50,47,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const p of this.model.points) {
      const s1 = this.toScreen(p);
      const yPred = intercept + slope * p.x;
      const s2 = this.toScreen({ x: p.x, y: yPred });
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    drawLine(intercept, slope, 'rgba(220,50,47,0.95)', 2.4);

    // Data points
    for (const p of this.model.points) {
      const s = this.toScreen(p);
      ctx.fillStyle = 'rgba(38,139,210,0.95)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(s.x, s.y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('x', r.x + r.w / 2, this.height - 4);

    ctx.save();
    ctx.translate(12, r.y + r.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('y', 0, 0);
    ctx.restore();

    // Legend (top right)
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(244,162,97,0.9)';
    ctx.fillText('真實 y = 0.5 + 1.4x', r.x + r.w - 4, r.y + 4);
    ctx.fillStyle = 'rgba(220,50,47,0.95)';
    ctx.fillText(`MLE 擬合 ŷ = ${intercept.toFixed(2)} + ${slope.toFixed(2)}x`, r.x + r.w - 4, r.y + 18);
  }
}

// ─────────────────────────────────────────── contour

export interface MLEContourOptions extends Canvas2DBaseOptions {
  model: MLEModel;
}

export class MLEContourScene extends Canvas2DBase {
  private readonly model: MLEModel;
  private unsubscribe: () => void;

  constructor(options: MLEContourOptions) {
    super(options);
    this.model = options.model;
    this.unsubscribe = this.model.onChange(() => this.scheduleRender());
  }

  public override destroy(): void {
    this.unsubscribe();
    super.destroy();
  }

  private plotRect(): { x: number; y: number; w: number; h: number } {
    return { x: 56, y: 14, w: this.width - 56 - 18, h: this.height - 14 - 28 };
  }

  protected draw(): void {
    const ctx = this.ctx;
    const r = this.plotRect();
    if (r.w <= 0 || r.h <= 0) return;

    const { intercept: mleB0, slope: mleB1 } = this.model.mle();
    // Centre window on MLE; size based on # of points and noise
    const halfB0 = 1.5;
    const halfB1 = 1.5;
    const b0Min = mleB0 - halfB0;
    const b0Max = mleB0 + halfB0;
    const b1Min = mleB1 - halfB1;
    const b1Max = mleB1 + halfB1;

    // Grid NLL — sample at modest resolution then render as tiles
    const G = 60;
    const grid: number[][] = [];
    let nllMin = Infinity;
    let nllMax = -Infinity;
    for (let j = 0; j < G; j++) {
      const row: number[] = [];
      const b1 = b1Min + ((b1Max - b1Min) * j) / (G - 1);
      for (let i = 0; i < G; i++) {
        const b0 = b0Min + ((b0Max - b0Min) * i) / (G - 1);
        const v = this.model.nll(b0, b1);
        row.push(v);
        if (v < nllMin) nllMin = v;
        if (v > nllMax) nllMax = v;
      }
      grid.push(row);
    }

    // Render tiles. Use sqrt scaling so the well around the minimum is visible.
    const tileW = r.w / (G - 1);
    const tileH = r.h / (G - 1);
    const norm = (v: number) => {
      const t = (v - nllMin) / Math.max(1e-9, nllMax - nllMin);
      return Math.pow(t, 0.45); // gamma to spread out the low end
    };

    for (let j = 0; j < G - 1; j++) {
      for (let i = 0; i < G - 1; i++) {
        const t = norm((grid[j][i] + grid[j + 1][i] + grid[j][i + 1] + grid[j + 1][i + 1]) / 4);
        // Map t∈[0,1] to a magenta→deep-blue gradient (low = warm, high = cool)
        const rC = Math.round(220 * (1 - t) + 38 * t);
        const gC = Math.round(50 * (1 - t) + 110 * t);
        const bC = Math.round(80 * (1 - t) + 200 * t);
        const a = 0.65;
        ctx.fillStyle = `rgba(${rC},${gC},${bC},${a})`;
        const px = r.x + i * tileW;
        const py = r.y + r.h - (j + 1) * tileH; // y flipped
        ctx.fillRect(px, py, tileW + 0.5, tileH + 0.5);
      }
    }

    // Contour lines at quantile levels
    const levels = [0.05, 0.15, 0.3, 0.5, 0.75].map((q) => nllMin + (nllMax - nllMin) * q);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (const level of levels) this.marchingSquares(grid, G, level, r, b0Min, b0Max, b1Min, b1Max);

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.h);
    ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke();

    // Tick labels
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = b1Min + ((b1Max - b1Min) / yTicks) * i;
      const y = r.y + r.h - ((v - b1Min) / (b1Max - b1Min)) * r.h;
      ctx.fillText(v.toFixed(2), r.x - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const v = b0Min + ((b0Max - b0Min) / xTicks) * i;
      const x = r.x + ((v - b0Min) / (b0Max - b0Min)) * r.w;
      ctx.fillText(v.toFixed(2), x, r.y + r.h + 4);
    }

    // MLE crosshair
    const mleX = r.x + ((mleB0 - b0Min) / (b0Max - b0Min)) * r.w;
    const mleY = r.y + r.h - ((mleB1 - b1Min) / (b1Max - b1Min)) * r.h;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.fillStyle = 'rgba(244,162,97,1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mleX - 10, mleY); ctx.lineTo(mleX + 10, mleY);
    ctx.moveTo(mleX, mleY - 10); ctx.lineTo(mleX, mleY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mleX, mleY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();

    // True parameters cross (faint)
    const trueX = r.x + ((TRUE_INTERCEPT - b0Min) / (b0Max - b0Min)) * r.w;
    const trueY = r.y + r.h - ((TRUE_SLOPE - b1Min) / (b1Max - b1Min)) * r.h;
    if (trueX > r.x && trueX < r.x + r.w && trueY > r.y && trueY < r.y + r.h) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(trueX - 8, trueY - 8); ctx.lineTo(trueX + 8, trueY + 8);
      ctx.moveTo(trueX - 8, trueY + 8); ctx.lineTo(trueX + 8, trueY - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('β₀ (截距)', r.x + r.w / 2, this.height - 4);

    ctx.save();
    ctx.translate(14, r.y + r.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('β₁ (斜率)', 0, 0);
    ctx.restore();
  }

  // Bare-bones marching-squares: draws line segments where grid crosses `level`.
  private marchingSquares(
    grid: number[][],
    G: number,
    level: number,
    r: { x: number; y: number; w: number; h: number },
    b0Min: number, b0Max: number,
    b1Min: number, b1Max: number,
  ): void {
    const ctx = this.ctx;
    const xAt = (i: number) => r.x + (i / (G - 1)) * r.w;
    const yAt = (j: number) => r.y + r.h - (j / (G - 1)) * r.h;
    const lerp = (a: number, b: number, va: number, vb: number) => a + ((level - va) / (vb - va)) * (b - a);

    ctx.beginPath();
    for (let j = 0; j < G - 1; j++) {
      for (let i = 0; i < G - 1; i++) {
        const v00 = grid[j][i];
        const v10 = grid[j][i + 1];
        const v11 = grid[j + 1][i + 1];
        const v01 = grid[j + 1][i];
        const c =
          (v00 > level ? 1 : 0) +
          (v10 > level ? 2 : 0) +
          (v11 > level ? 4 : 0) +
          (v01 > level ? 8 : 0);
        if (c === 0 || c === 15) continue;

        const x0 = xAt(i), x1 = xAt(i + 1);
        const y0 = yAt(j), y1 = yAt(j + 1);
        const segs: [number, number, number, number][] = [];
        const lerpB = (ya: number, yb: number, va: number, vb: number) => lerp(ya, yb, va, vb);

        const top = [x0 + ((level - v00) / (v10 - v00 || 1e-9)) * (x1 - x0), y0] as [number, number];
        const right = [x1, lerpB(y0, y1, v10, v11)] as [number, number];
        const bottom = [x0 + ((level - v01) / (v11 - v01 || 1e-9)) * (x1 - x0), y1] as [number, number];
        const left = [x0, lerpB(y0, y1, v00, v01)] as [number, number];

        switch (c) {
          case 1: case 14: segs.push([left[0], left[1], top[0], top[1]]); break;
          case 2: case 13: segs.push([top[0], top[1], right[0], right[1]]); break;
          case 3: case 12: segs.push([left[0], left[1], right[0], right[1]]); break;
          case 4: case 11: segs.push([right[0], right[1], bottom[0], bottom[1]]); break;
          case 5:
            segs.push([left[0], left[1], top[0], top[1]]);
            segs.push([right[0], right[1], bottom[0], bottom[1]]);
            break;
          case 6: case 9: segs.push([top[0], top[1], bottom[0], bottom[1]]); break;
          case 7: case 8: segs.push([left[0], left[1], bottom[0], bottom[1]]); break;
          case 10:
            segs.push([left[0], left[1], bottom[0], bottom[1]]);
            segs.push([top[0], top[1], right[0], right[1]]);
            break;
        }
        for (const [ax, ay, bx, by] of segs) {
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
      }
    }
    ctx.stroke();
  }
}
