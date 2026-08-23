/**
 * UncertaintyScene — Δx·Δp ≥ ħ/2 as a statement about Fourier transforms.
 *
 * The page's thesis is that the uncertainty principle is not about a clumsy
 * measurement disturbing a particle: it is a property every wave has, because
 * a function and its Fourier transform cannot both be narrow. So this scene
 * does exactly one thing — build ψ(x), FFT it, and measure the two widths
 * numerically. Nothing is hard-coded to come out at 0.5; the Gaussian lands
 * there because it really is the minimum-uncertainty state.
 *
 * ħ = 1 throughout, so p = k and the bound reads Δx·Δk ≥ ½.
 *
 * One deliberate modelling choice: the "square" packet is a super-Gaussian
 * exp(−(x/w)^8), not a true top hat. A true top hat has sinc tails, whose
 * ⟨k²⟩ diverges — on a finite grid it would report a *grid-dependent* Δp and
 * quietly lie. The super-Gaussian keeps the flat top and the ringing side
 * lobes while staying honest about its moments.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import { fft, fftFreqs, fftShift } from './fft';

const N = 1024;
const X_SPAN = 40;
const DX = X_SPAN / N;
const DK = (2 * Math.PI) / (N * DX);

export type PacketMode = 'gaussian' | 'square' | 'double';

export interface UncertaintyStats {
  mode: PacketMode;
  width: number;
  k0: number;
  deltaX: number;
  deltaP: number;
  product: number;
  /** how far above the ħ/2 floor, as a ratio — 1.00 means "at the minimum" */
  excess: number;
}

export interface UncertaintySceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: UncertaintyStats) => void;
}

export class UncertaintyScene extends Canvas2DBase {
  private mode: PacketMode = 'gaussian';
  private width_ = 1.2;
  private k0 = 4;

  private readonly x = new Float64Array(N);
  private readonly k = fftFreqs(N, DX);
  private readonly psiRe = new Float64Array(N);
  private readonly psiIm = new Float64Array(N);
  private readonly probX = new Float64Array(N);
  private readonly probK = new Float64Array(N);

  private kSorted = new Float64Array(N);
  private probKSorted = new Float64Array(N);

  private meanX = 0;
  private meanK = 0;
  private deltaX = 0;
  private deltaK = 0;

  private readonly onStats?: (s: UncertaintyStats) => void;

  constructor(options: UncertaintySceneOptions) {
    super(options);
    this.onStats = options.onStats;
    for (let i = 0; i < N; i++) this.x[i] = -X_SPAN / 2 + i * DX;
    this.kSorted = fftShift(this.k);
    this.rebuild();
  }

  // ─────────────────────────────────────────── model

  private envelope(x: number): number {
    const w = this.width_;
    switch (this.mode) {
      case 'gaussian':
        return Math.exp(-(x * x) / (4 * w * w));
      case 'square':
        // super-Gaussian: flat top, finite ⟨k²⟩ (see the file header)
        return Math.exp(-Math.pow(Math.abs(x) / (w * 1.6), 8));
      case 'double': {
        const d = w * 2.4;
        const s = 0.45;
        return (
          Math.exp(-Math.pow(x - d / 2, 2) / (4 * s * s)) +
          Math.exp(-Math.pow(x + d / 2, 2) / (4 * s * s))
        );
      }
    }
  }

  private rebuild(): void {
    // 1. sample ψ(x) = envelope(x) · e^{i k₀ x}
    for (let i = 0; i < N; i++) {
      const xi = this.x[i];
      const a = this.envelope(xi);
      const ph = this.k0 * xi;
      this.psiRe[i] = a * Math.cos(ph);
      this.psiIm[i] = a * Math.sin(ph);
    }

    // 2. normalise ∫|ψ|²dx = 1
    let norm = 0;
    for (let i = 0; i < N; i++) {
      norm += (this.psiRe[i] ** 2 + this.psiIm[i] ** 2) * DX;
    }
    const scale = 1 / Math.sqrt(norm);
    for (let i = 0; i < N; i++) {
      this.psiRe[i] *= scale;
      this.psiIm[i] *= scale;
      this.probX[i] = this.psiRe[i] ** 2 + this.psiIm[i] ** 2;
    }

    // 3. transform (on a copy — the FFT is in place)
    const re = Float64Array.from(this.psiRe);
    const im = Float64Array.from(this.psiIm);
    fft(re, im);
    let kNorm = 0;
    for (let i = 0; i < N; i++) {
      this.probK[i] = re[i] ** 2 + im[i] ** 2;
      kNorm += this.probK[i] * DK;
    }
    for (let i = 0; i < N; i++) this.probK[i] /= kNorm;

    // 4. moments — plain numeric integration, no closed forms
    this.meanX = this.moment(this.x, this.probX, DX, 1);
    const x2 = this.moment(this.x, this.probX, DX, 2);
    this.deltaX = Math.sqrt(Math.max(0, x2 - this.meanX ** 2));

    this.meanK = this.moment(this.k, this.probK, DK, 1);
    const k2 = this.moment(this.k, this.probK, DK, 2);
    this.deltaK = Math.sqrt(Math.max(0, k2 - this.meanK ** 2));

    this.probKSorted = fftShift(this.probK);

    this.emit();
    this.scheduleRender();
  }

  private moment(grid: Float64Array, prob: Float64Array, d: number, power: 1 | 2): number {
    let sum = 0;
    for (let i = 0; i < grid.length; i++) {
      sum += (power === 1 ? grid[i] : grid[i] * grid[i]) * prob[i] * d;
    }
    return sum;
  }

  private emit(): void {
    const product = this.deltaX * this.deltaK;
    this.onStats?.({
      mode: this.mode,
      width: this.width_,
      k0: this.k0,
      deltaX: this.deltaX,
      deltaP: this.deltaK,
      product,
      excess: product / 0.5,
    });
  }

  // ─────────────────────────────────────────── controls

  public setMode(mode: PacketMode): void { this.mode = mode; this.rebuild(); }
  public setWidth(w: number): void { this.width_ = w; this.rebuild(); }
  public setK0(k: number): void { this.k0 = k; this.rebuild(); }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);

    const gap = 8;
    const half = (this.height - gap) / 2;
    this.drawXPanel(0, half);
    this.drawKPanel(half + gap, half);
  }

  private frame(oy: number, h: number): { x0: number; y0: number; pw: number; ph: number } {
    return { x0: 44, y0: oy + 16, pw: this.width - 44 - 14, ph: h - 16 - 24 };
  }

  private axis(x0: number, y0: number, pw: number, ph: number, label: string, ticks: [number, string][], toX: (v: number) => number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(88,110,117,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ph);
    ctx.lineTo(x0 + pw, y0 + ph);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const [v, text] of ticks) {
      const px = toX(v);
      if (px < x0 - 1 || px > x0 + pw + 1) continue;
      ctx.beginPath();
      ctx.moveTo(px, y0 + ph);
      ctx.lineTo(px, y0 + ph + 4);
      ctx.stroke();
      ctx.fillText(text, px, y0 + ph + 6);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(label, x0 + 2, y0 - 13);
  }

  private drawXPanel(oy: number, h: number): void {
    const ctx = this.ctx;
    const { x0, y0, pw, ph } = this.frame(oy, h);
    // zoom to where the packet actually lives, so thin packets stay visible
    const span = Math.max(6, Math.min(X_SPAN, this.deltaX * 9 + 3));
    const toX = (v: number) => x0 + ((v + span / 2) / span) * pw;

    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, this.probX[i]);
    const toY = (v: number) => y0 + ph - (v / (peak || 1)) * ph * 0.92;

    this.drawSpread(x0, y0, pw, ph, toX(this.meanX - this.deltaX), toX(this.meanX + this.deltaX), 'rgba(42,161,152,0.13)');

    // Re ψ — shows the carrier k₀ that the |ψ|² envelope hides
    let amp = 0;
    for (let i = 0; i < N; i++) amp = Math.max(amp, Math.abs(this.psiRe[i]));
    ctx.strokeStyle = 'rgba(38,139,210,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = toX(this.x[i]);
      const py = y0 + ph / 2 - (this.psiRe[i] / (amp || 1)) * (ph / 2) * 0.86;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // |ψ|²
    ctx.beginPath();
    ctx.moveTo(toX(this.x[0]), y0 + ph);
    for (let i = 0; i < N; i++) ctx.lineTo(toX(this.x[i]), toY(this.probX[i]));
    ctx.lineTo(toX(this.x[N - 1]), y0 + ph);
    ctx.closePath();
    ctx.fillStyle = 'rgba(42,161,152,0.32)';
    ctx.fill();
    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = toX(this.x[i]);
      const py = toY(this.probX[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const step = niceStep(span / 6);
    const ticks: [number, string][] = [];
    for (let v = -Math.ceil(span / 2 / step) * step; v <= span / 2; v += step) {
      ticks.push([v, formatTick(v)]);
    }
    this.axis(x0, y0, pw, ph, '位置空間 |ψ(x)|²  ·  藍線 = Re ψ', ticks, toX);
    this.label(x0 + pw, y0 - 13, `Δx = ${this.deltaX.toFixed(3)}`, '#2aa198');
  }

  private drawKPanel(oy: number, h: number): void {
    const ctx = this.ctx;
    const { x0, y0, pw, ph } = this.frame(oy, h);
    const centre = this.meanK;
    const span = Math.max(4, this.deltaK * 9 + 2);
    const toX = (v: number) => x0 + ((v - centre + span / 2) / span) * pw;

    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, this.probK[i]);
    const toY = (v: number) => y0 + ph - (v / (peak || 1)) * ph * 0.92;

    this.drawSpread(x0, y0, pw, ph, toX(centre - this.deltaK), toX(centre + this.deltaK), 'rgba(211,54,130,0.13)');

    ctx.beginPath();
    ctx.moveTo(toX(this.kSorted[0]), y0 + ph);
    for (let i = 0; i < N; i++) ctx.lineTo(toX(this.kSorted[i]), toY(this.probKSorted[i]));
    ctx.lineTo(toX(this.kSorted[N - 1]), y0 + ph);
    ctx.closePath();
    ctx.fillStyle = 'rgba(211,54,130,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#d33682';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = toX(this.kSorted[i]);
      const py = toY(this.probKSorted[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const step = niceStep(span / 6);
    const ticks: [number, string][] = [];
    const first = Math.ceil((centre - span / 2) / step) * step;
    for (let v = first; v <= centre + span / 2; v += step) ticks.push([v, formatTick(v)]);
    this.axis(x0, y0, pw, ph, '動量空間 |φ(k)|²   (ħ = 1，所以 p = k)', ticks, toX);
    this.label(x0 + pw, y0 - 13, `Δp = ${this.deltaK.toFixed(3)}`, '#d33682');
  }

  private drawSpread(x0: number, y0: number, pw: number, ph: number, a: number, b: number, fill: string): void {
    const ctx = this.ctx;
    const lo = Math.max(x0, Math.min(a, b));
    const hi = Math.min(x0 + pw, Math.max(a, b));
    if (hi <= lo) return;
    ctx.fillStyle = fill;
    ctx.fillRect(lo, y0, hi - lo, ph);
    ctx.strokeStyle = 'rgba(253,246,227,0.25)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    for (const px of [lo, hi]) {
      ctx.beginPath();
      ctx.moveTo(px, y0);
      ctx.lineTo(px, y0 + ph);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private label(x: number, y: number, text: string, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  }
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const mult = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return mult * mag;
}

function formatTick(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  return Math.abs(v) < 1 ? v.toFixed(1) : v.toFixed(Math.abs(v) < 10 ? 1 : 0);
}
