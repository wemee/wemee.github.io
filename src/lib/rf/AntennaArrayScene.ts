/**
 * AntennaArrayScene — a uniform linear array, and the fact that its pattern is
 * a Fourier transform of its excitation.
 *
 * For N elements spaced d apart, each fed with a progressive phase β:
 *
 *   AF(θ) = Σ aₙ · e^{ j n (k d sinθ + β) },   k = 2π/λ
 *
 * Substitute u = sinθ and that is literally a DFT of the element weights aₙ
 * evaluated on the unit circle. Every consequence follows from that one fact
 * and mirrors something the reader already met on /physics/uncertainty:
 *
 *   - a wider aperture gives a narrower beam            (Δx·Δk ≥ ½)
 *   - a hard-edged (uniform) excitation gives −13.2 dB sidelobes, and tapering
 *     the edges trades beamwidth for sidelobe suppression   (square vs Gaussian)
 *   - sampling the aperture too coarsely (d > λ/2) aliases, and the alias is
 *     visible as a grating lobe                         (Nyquist)
 *
 * Directivity is integrated numerically rather than quoted from a rule of
 * thumb: D = 2·|AF|²ₘₐₓ / ∫₋₁¹ |AF(u)|² du for isotropic elements.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

export type Taper = 'uniform' | 'hamming' | 'gaussian';

const DYNAMIC_RANGE_DB = 40;
const SAMPLES = 1441;

export interface AntennaStats {
  elements: number;
  spacingLambda: number;
  steerDeg: number;
  taper: Taper;
  hpbwDeg: number | null;
  sidelobeDb: number | null;
  directivityDbi: number;
  apertureLambda: number;
  gratingLobe: boolean;
}

export interface AntennaArraySceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: AntennaStats) => void;
}

export class AntennaArrayScene extends Canvas2DBase {
  private elements = 8;
  private spacingLambda = 0.5;
  private steerDeg = 0;
  private taper: Taper = 'uniform';

  private pattern = new Float64Array(SAMPLES); // |AF| normalised to peak = 1
  private stats: AntennaStats | null = null;
  private readonly onStats?: (s: AntennaStats) => void;

  constructor(options: AntennaArraySceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.recompute();
  }

  // ─────────────────────────────────────────── model

  private weights(): Float64Array {
    const n = this.elements;
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0.5 : i / (n - 1);
      switch (this.taper) {
        case 'uniform': w[i] = 1; break;
        case 'hamming': w[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * x); break;
        case 'gaussian': w[i] = Math.exp(-0.5 * ((x - 0.5) / 0.22) ** 2); break;
      }
    }
    return w;
  }

  /** |AF| at a given u = sinθ, using the current weights and steering phase. */
  private afAtU(u: number, w: Float64Array): number {
    const kd = 2 * Math.PI * this.spacingLambda;
    const beta = -kd * Math.sin((this.steerDeg * Math.PI) / 180);
    let re = 0;
    let im = 0;
    for (let i = 0; i < this.elements; i++) {
      const ph = i * (kd * u + beta);
      re += w[i] * Math.cos(ph);
      im += w[i] * Math.sin(ph);
    }
    return Math.hypot(re, im);
  }

  private recompute(): void {
    const w = this.weights();

    // pattern over θ ∈ [−90°, 90°]
    let peak = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const theta = (-90 + (180 * i) / (SAMPLES - 1)) * (Math.PI / 180);
      const v = this.afAtU(Math.sin(theta), w);
      this.pattern[i] = v;
      if (v > peak) peak = v;
    }
    if (peak > 0) for (let i = 0; i < SAMPLES; i++) this.pattern[i] /= peak;

    // directivity: 2·max / ∫ over u, isotropic elements
    const uSamples = 4001;
    let integral = 0;
    let uPeak = 0;
    for (let i = 0; i < uSamples; i++) {
      const u = -1 + (2 * i) / (uSamples - 1);
      const p = this.afAtU(u, w) ** 2;
      integral += p * (2 / (uSamples - 1));
      if (p > uPeak) uPeak = p;
    }
    const directivity = integral > 0 ? (2 * uPeak) / integral : 1;

    this.stats = {
      elements: this.elements,
      spacingLambda: this.spacingLambda,
      steerDeg: this.steerDeg,
      taper: this.taper,
      hpbwDeg: this.halfPowerBeamwidth(),
      sidelobeDb: this.peakSidelobeDb(),
      directivityDbi: 10 * Math.log10(Math.max(1e-9, directivity)),
      apertureLambda: (this.elements - 1) * this.spacingLambda,
      // a grating lobe enters the visible region once d/λ·(1 + |sin θ₀|) ≥ 1
      gratingLobe: this.spacingLambda * (1 + Math.abs(Math.sin((this.steerDeg * Math.PI) / 180))) >= 1,
    };
    this.onStats?.(this.stats);
    this.scheduleRender();
  }

  private thetaAt(i: number): number {
    return -90 + (180 * i) / (SAMPLES - 1);
  }

  /** Width in degrees of the main lobe at −3 dB, found by walking outwards. */
  private halfPowerBeamwidth(): number | null {
    let peakIdx = 0;
    for (let i = 1; i < SAMPLES; i++) if (this.pattern[i] > this.pattern[peakIdx]) peakIdx = i;
    const half = Math.SQRT1_2; // −3 dB in amplitude
    let lo = -1;
    let hi = -1;
    for (let i = peakIdx; i >= 0; i--) if (this.pattern[i] <= half) { lo = i; break; }
    for (let i = peakIdx; i < SAMPLES; i++) if (this.pattern[i] <= half) { hi = i; break; }
    if (lo < 0 || hi < 0) return null; // beam runs off the visible region
    return this.thetaAt(hi) - this.thetaAt(lo);
  }

  /** Highest sidelobe relative to the main lobe, in dB (negative). */
  private peakSidelobeDb(): number | null {
    let peakIdx = 0;
    for (let i = 1; i < SAMPLES; i++) if (this.pattern[i] > this.pattern[peakIdx]) peakIdx = i;
    // walk down from the peak until the pattern turns back up — that is the
    // first null; anything beyond it is a sidelobe
    let left = peakIdx;
    while (left > 0 && this.pattern[left - 1] < this.pattern[left]) left--;
    let right = peakIdx;
    while (right < SAMPLES - 1 && this.pattern[right + 1] < this.pattern[right]) right++;
    let best = 0;
    for (let i = 0; i < SAMPLES; i++) {
      if (i >= left && i <= right) continue;
      if (this.pattern[i] > best) best = this.pattern[i];
    }
    return best > 0 ? 20 * Math.log10(best) : null;
  }

  // ─────────────────────────────────────────── controls

  public setElements(n: number): void { this.elements = Math.max(1, Math.round(n)); this.recompute(); }
  public setSpacing(d: number): void { this.spacingLambda = d; this.recompute(); }
  public setSteer(deg: number): void { this.steerDeg = deg; this.recompute(); }
  public setTaper(t: Taper): void { this.taper = t; this.recompute(); }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const stripH = Math.max(74, this.height * 0.24);
    this.drawPolar(0, this.height - stripH - 6);
    this.drawArrayStrip(this.height - stripH, stripH);
  }

  private drawPolar(oy: number, h: number): void {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = oy + h - 14;
    const R = Math.min(h - 26, this.width / 2 - 30);
    if (R < 30) return;

    const dbToR = (db: number) => {
      const clamped = Math.max(-DYNAMIC_RANGE_DB, Math.min(0, db));
      return R * (1 + clamped / DYNAMIC_RANGE_DB);
    };

    // rings every 10 dB
    ctx.strokeStyle = 'rgba(88,110,117,0.35)';
    ctx.fillStyle = 'rgba(147,161,161,0.65)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.lineWidth = 1;
    for (let db = 0; db >= -DYNAMIC_RANGE_DB; db -= 10) {
      const r = dbToR(db);
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.stroke();
      if (db < 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${db}`, cx, cy - r + 11);
      }
    }

    // angle spokes
    for (let a = -90; a <= 90; a += 30) {
      const rad = (a * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(rad) * R, cy - Math.cos(rad) * R);
      ctx.stroke();
      ctx.fillStyle = 'rgba(147,161,161,0.75)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${a}°`, cx + Math.sin(rad) * (R + 15), cy - Math.cos(rad) * (R + 15));
    }

    // the pattern
    ctx.beginPath();
    for (let i = 0; i < SAMPLES; i++) {
      const db = 20 * Math.log10(Math.max(1e-6, this.pattern[i]));
      const r = dbToR(db);
      const rad = (this.thetaAt(i) * Math.PI) / 180;
      const px = cx + Math.sin(rad) * r;
      const py = cy - Math.cos(rad) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(42,161,152,0.18)';
    ctx.fill();

    // where we asked the beam to point
    const srad = (this.steerDeg * Math.PI) / 180;
    ctx.strokeStyle = 'rgba(181,137,0,0.85)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(srad) * R, cy - Math.cos(srad) * R);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('陣列因子（dB，0 為主波束）', 10, oy + 6);

    if (this.stats?.gratingLobe) {
      ctx.fillStyle = '#dc322f';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('⚠ 出現柵瓣（取樣過疏）', this.width - 10, oy + 6);
    }
  }

  private drawArrayStrip(oy: number, h: number): void {
    const ctx = this.ctx;
    const padX = 30;
    const y = oy + h * 0.55;
    const w = this.weights();
    const maxW = Math.max(...Array.from(w));
    const n = this.elements;
    const span = this.width - padX * 2;
    // keep physical spacing honest: the strip scales with (N−1)·d/λ
    const aperture = Math.max(0.5, (n - 1) * this.spacingLambda);
    const scale = Math.min(span / aperture, span);
    const totalW = aperture * scale;
    const x0 = (this.width - totalW) / 2;

    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 12, y);
    ctx.lineTo(x0 + totalW + 12, y);
    ctx.stroke();

    const kd = 2 * Math.PI * this.spacingLambda;
    const beta = -kd * Math.sin((this.steerDeg * Math.PI) / 180);
    for (let i = 0; i < n; i++) {
      const px = n === 1 ? this.width / 2 : x0 + (i * this.spacingLambda * scale);
      const amp = maxW > 0 ? w[i] / maxW : 1;
      const barH = amp * (h * 0.3);
      ctx.fillStyle = '#268bd2';
      ctx.globalAlpha = 0.35 + 0.65 * amp;
      ctx.fillRect(px - 3, y - barH, 6, barH);
      ctx.globalAlpha = 1;
      // phase as a little rotating tick
      const ph = i * beta;
      ctx.strokeStyle = '#b58900';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, y + 8);
      ctx.lineTo(px + Math.cos(ph) * 7, y + 8 - Math.sin(ph) * 7);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${n} 個元件 · 間距 ${this.spacingLambda.toFixed(2)}λ · 孔徑 ${((n - 1) * this.spacingLambda).toFixed(2)}λ`, padX, oy + 4);
    ctx.textAlign = 'right';
    ctx.fillText('藍柱 = 激發振幅　黃針 = 相位', this.width - padX, oy + 4);
  }
}
