/**
 * BellScene — run the CHSH experiment yourself and watch S cross 2.
 *
 * State: the polarisation-entangled |Φ⁺⟩ = (|HH⟩ + |VV⟩)/√2, for which
 * quantum mechanics predicts E(α, β) = cos(2(α − β)).
 *
 * Three generators are available, and the comparison between them is the
 * entire lesson:
 *
 *   quantum   — sample from the QM joint distribution. S → 2√2 ≈ 2.828.
 *   hidden    — a *local* hidden-variable model: each pair carries a shared
 *               polarisation angle λ, and each side answers using only its own
 *               analyser angle and λ. Physically motivated, and capped at 2.
 *   best      — the optimal local strategy: fixed answers per setting, with a
 *               shared random sign so the raw outcomes still look like coin
 *               flips. Hits S = 2 exactly, which shows the bound is tight and
 *               not an artefact of a badly chosen model.
 *
 * Analyser settings are drawn independently at random for every pair. That is
 * not decoration — CHSH assumes the two choices are free and uncorrelated with
 * λ, and doing it any other way would quietly break the derivation.
 *
 * Everything here is sampling and estimation. There is no wavefunction
 * collapse to narrate and no observer with a mind; what the page claims is
 * only what the counters can support.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

export const CLASSICAL_BOUND = 2;
export const TSIRELSON_BOUND = 2 * Math.SQRT2;

/** The CHSH-optimal analyser settings, in degrees. */
export const OPTIMAL_ANGLES = { a1: 0, a2: 45, b1: 22.5, b2: 67.5 };

const MAX_HISTORY = 600;

export type BellMode = 'quantum' | 'hidden' | 'best';

export interface BellStats {
  mode: BellMode;
  pairs: number;
  /** E(a1,b1), E(a1,b2), E(a2,b1), E(a2,b2) */
  correlations: [number, number, number, number];
  counts: [number, number, number, number];
  S: number;
  sigmaS: number;
  angles: { a1: number; a2: number; b1: number; b2: number };
  streaming: boolean;
  lastOutcome: { alice: number; bob: number; aIdx: 0 | 1; bIdx: 0 | 1 } | null;
}

export interface BellSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: BellStats) => void;
}

interface HistoryPoint {
  n: number;
  S: number;
}

export class BellScene extends Canvas2DBase {
  private mode: BellMode = 'quantum';
  private angles = { ...OPTIMAL_ANGLES };

  private readonly n = [0, 0, 0, 0];
  private readonly sum = [0, 0, 0, 0];
  private pairs = 0;

  private history: HistoryPoint[] = [];
  private historyEvery = 20;

  private streaming = false;
  private rate = 400;
  private lastOutcome: BellStats['lastOutcome'] = null;

  private rafId: number | null = null;
  private rngState = 0x1f123bb5;
  private readonly onStats?: (s: BellStats) => void;

  constructor(options: BellSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
    this.emit();
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    super.destroy();
  }

  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ─────────────────────────────────────────── the experiment

  private rad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private onePair(): void {
    const aIdx: 0 | 1 = this.random() < 0.5 ? 0 : 1;
    const bIdx: 0 | 1 = this.random() < 0.5 ? 0 : 1;
    const alpha = this.rad(aIdx === 0 ? this.angles.a1 : this.angles.a2);
    const beta = this.rad(bIdx === 0 ? this.angles.b1 : this.angles.b2);

    let A: number;
    let B: number;

    if (this.mode === 'quantum') {
      // |Φ⁺⟩: marginals are 50/50, and the two agree with probability cos²Δ
      A = this.random() < 0.5 ? 1 : -1;
      const d = alpha - beta;
      const pSame = Math.cos(d) ** 2; // ⇒ E = 2cos²Δ − 1 = cos(2Δ), as QM says
      B = this.random() < pSame ? A : -A;
    } else if (this.mode === 'hidden') {
      // shared polarisation angle λ; each side sees only its own analyser
      const lambda = this.random() * Math.PI;
      A = Math.cos(2 * (alpha - lambda)) >= 0 ? 1 : -1;
      B = Math.cos(2 * (beta - lambda)) >= 0 ? 1 : -1;
    } else {
      // optimal local strategy: fixed table + a shared random sign
      const lambda = this.random() < 0.5 ? 1 : -1;
      A = lambda;
      B = lambda * (bIdx === 0 ? 1 : -1);
    }

    const slot = aIdx * 2 + bIdx;
    this.n[slot]++;
    this.sum[slot] += A * B;
    this.pairs++;
    this.lastOutcome = { alice: A, bob: B, aIdx, bIdx };

    if (this.pairs % this.historyEvery === 0) this.pushHistory();
  }

  private pushHistory(): void {
    this.history = [...this.history, { n: this.pairs, S: this.currentS() }];
    if (this.history.length > MAX_HISTORY) {
      // keep the whole run visible rather than sliding a window off the start
      this.history = this.history.filter((_, i) => i % 2 === 0);
      this.historyEvery *= 2;
    }
  }

  private correlations(): [number, number, number, number] {
    return [0, 1, 2, 3].map((i) => (this.n[i] > 0 ? this.sum[i] / this.n[i] : 0)) as [number, number, number, number];
  }

  private currentS(): number {
    const [e11, e12, e21, e22] = this.correlations();
    return e11 - e12 + e21 + e22;
  }

  private sigmaS(): number {
    const e = this.correlations();
    let v = 0;
    for (let i = 0; i < 4; i++) {
      if (this.n[i] > 1) v += (1 - e[i] * e[i]) / this.n[i];
    }
    return Math.sqrt(v);
  }

  public run(count: number): void {
    for (let i = 0; i < count; i++) this.onePair();
    this.emit();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── controls

  public setMode(mode: BellMode): void {
    this.mode = mode;
    this.reset();
  }

  public setAngle(which: 'a1' | 'a2' | 'b1' | 'b2', deg: number): void {
    this.angles = { ...this.angles, [which]: deg };
    this.reset();
  }

  public useOptimalAngles(): void {
    this.angles = { ...OPTIMAL_ANGLES };
    this.reset();
  }

  public toggleStream(): void {
    this.streaming = !this.streaming;
    this.emit();
  }

  public reset(): void {
    this.n.fill(0);
    this.sum.fill(0);
    this.pairs = 0;
    this.history = [];
    this.historyEvery = 20;
    this.lastOutcome = null;
    this.emit();
    this.scheduleRender();
  }

  private emit(): void {
    this.onStats?.({
      mode: this.mode,
      pairs: this.pairs,
      correlations: this.correlations(),
      counts: [this.n[0], this.n[1], this.n[2], this.n[3]],
      S: this.currentS(),
      sigmaS: this.sigmaS(),
      angles: { ...this.angles },
      streaming: this.streaming,
      lastOutcome: this.lastOutcome,
    });
  }

  private loop(): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.streaming) this.run(this.rate);
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const schematicH = Math.max(120, this.height * 0.38);
    this.drawSchematic(0, schematicH);
    this.drawConvergence(schematicH + 6, this.height - schematicH - 6);
  }

  private drawSchematic(oy: number, h: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const midY = oy + h * 0.52;
    const cx = W / 2;
    const dialR = Math.max(22, Math.min(38, h * 0.24));
    const aliceX = Math.max(dialR + 28, W * 0.17);
    const bobX = Math.min(W - dialR - 28, W * 0.83);

    // beam lines
    ctx.strokeStyle = 'rgba(88,110,117,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(aliceX + dialR, midY);
    ctx.lineTo(cx - 14, midY);
    ctx.moveTo(cx + 14, midY);
    ctx.lineTo(bobX - dialR, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // source
    const grad = ctx.createRadialGradient(cx, midY, 0, cx, midY, 16);
    grad.addColorStop(0, 'rgba(181,137,0,0.95)');
    grad.addColorStop(1, 'rgba(181,137,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, midY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('糾纏光子源', cx, midY + 20);

    const last = this.lastOutcome;
    const sides: [number, string, string, number, number | null][] = [
      [aliceX, 'Alice', '#268bd2', this.angles[last?.aIdx === 1 ? 'a2' : 'a1'], last ? last.alice : null],
      [bobX, 'Bob', '#d33682', this.angles[last?.bIdx === 1 ? 'b2' : 'b1'], last ? last.bob : null],
    ];

    for (const [x, name, color, angleDeg, outcome] of sides) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, midY, dialR, 0, Math.PI * 2);
      ctx.stroke();

      // polariser axis
      const a = (angleDeg * Math.PI) / 180;
      ctx.strokeStyle = '#fdf6e3';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * dialR * 0.82, midY + Math.sin(a) * dialR * 0.82);
      ctx.lineTo(x + Math.cos(a) * dialR * 0.82, midY - Math.sin(a) * dialR * 0.82);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(name, x, midY - dialR - 8);
      ctx.fillStyle = 'rgba(147,161,161,0.85)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`${angleDeg.toFixed(1)}°`, x, midY + dialR + 6);

      if (outcome !== null) {
        ctx.fillStyle = outcome > 0 ? '#859900' : '#dc322f';
        ctx.font = '600 15px ui-monospace, monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(outcome > 0 ? '+1' : '−1', x, midY + dialR + 24);
      }
    }
  }

  private drawConvergence(oy: number, h: number): void {
    if (h < 60) return;
    const ctx = this.ctx;
    const padL = 46;
    const padR = 14;
    const padT = 10;
    const padB = 22;
    const pw = this.width - padL - padR;
    const ph = h - padT - padB;
    const y0 = oy + padT;

    const sMin = 0;
    const sMax = 3.2;
    const toY = (s: number) => y0 + ph - ((s - sMin) / (sMax - sMin)) * ph;
    const nMax = Math.max(1000, this.pairs);
    const toX = (n: number) => padL + (n / nMax) * pw;

    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.strokeStyle = 'rgba(88,110,117,0.3)';
    ctx.lineWidth = 1;
    for (let s = 0; s <= 3.2; s += 0.5) {
      const y = toY(s);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pw, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.toFixed(1), padL - 5, y);
    }

    // the two bounds
    const bounds: [number, string, string][] = [
      [CLASSICAL_BOUND, '#dc322f', '古典上限 S = 2'],
      [TSIRELSON_BOUND, '#859900', 'Tsirelson 上限 2√2 ≈ 2.828'],
    ];
    for (const [v, color, label] of bounds) {
      ctx.strokeStyle = color;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padL, toY(v));
      ctx.lineTo(padL + pw, toY(v));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, padL + 4, toY(v) - 3);
    }

    // the region local realism cannot reach
    ctx.fillStyle = 'rgba(133,153,0,0.07)';
    ctx.fillRect(padL, toY(TSIRELSON_BOUND), pw, toY(CLASSICAL_BOUND) - toY(TSIRELSON_BOUND));

    if (this.history.length > 1) {
      ctx.strokeStyle = '#2aa198';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      this.history.forEach((p, i) => {
        const x = toX(p.n);
        const y = toY(Math.max(sMin, Math.min(sMax, p.S)));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // ±1σ band at the current estimate
      const s = this.currentS();
      const sig = this.sigmaS();
      const x = toX(this.pairs);
      ctx.strokeStyle = 'rgba(42,161,152,0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, toY(Math.min(sMax, s + sig)));
      ctx.lineTo(x, toY(Math.max(sMin, s - sig)));
      ctx.stroke();
      ctx.fillStyle = '#2aa198';
      ctx.beginPath();
      ctx.arc(x, toY(Math.max(sMin, Math.min(sMax, s))), 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(147,161,161,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('按下方按鈕開始跑實驗', padL + pw / 2, y0 + ph / 2);
    }

    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`已測量 ${this.pairs.toLocaleString('en-US')} 對`, padL + pw, y0 + ph + 5);
    ctx.textAlign = 'left';
    ctx.fillText('S 隨測量對數收斂', padL, y0 + ph + 5);
  }
}
