/**
 * TunnelingScene — the time-dependent Schrödinger equation, actually solved.
 *
 * Split-step Fourier with Strang splitting (ħ = m = 1):
 *
 *   ψ ← e^{−iV dt/2} · F⁻¹[ e^{−i k² dt/2} · F[ e^{−iV dt/2} ψ ] ]
 *
 * The kinetic operator is diagonal in k, the potential is diagonal in x, so
 * each half-step is a pointwise multiply and the only real work is two FFTs.
 * The scheme is unitary by construction, which is why the norm stays at 1
 * without any renormalisation fudge — the only probability that leaves is the
 * probability the absorbing edges deliberately take.
 *
 * Those edges matter: the FFT makes the grid periodic, so a packet that runs
 * off the right would reappear on the left and contaminate the reflection
 * measurement. A smooth sponge mask soaks it up instead, and the probability
 * it removes is booked to the correct side, so R + T still sums to 1.
 *
 * The measured T will NOT exactly equal the textbook plane-wave T. A packet
 * carries a spread of energies (that is the previous lesson), so what the
 * simulation reports is an average of T(E) over the packet's own |φ(k)|².
 * Both numbers are shown side by side precisely so the gap is visible.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import { fft, ifft, fftFreqs } from './fft';

const N = 1024;
const X_MIN = -80;
const X_MAX = 80;
const DX = (X_MAX - X_MIN) / N;
const DT = 0.004;
const STEPS_PER_FRAME = 8;
/** Packet starts here, far enough left to be well clear of the barrier. */
const START_X = -32;
const PACKET_SIGMA = 4;
/** Sponge starts this far in from each edge. */
const ABSORB_MARGIN = 18;

export type TunnelPresetId = 'tunnel' | 'at-threshold' | 'resonance' | 'thin-barrier';

export interface TunnelStats {
  time: number;
  energy: number;
  energySpread: number;
  barrierHeight: number;
  barrierWidth: number;
  k0: number;
  reflection: number;
  transmission: number;
  inside: number;
  analyticT: number;
  norm: number;
  running: boolean;
  finished: boolean;
  preset: TunnelPresetId | null;
}

export interface TunnelingSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: TunnelStats) => void;
}

const PRESETS: Record<TunnelPresetId, { V0: number; w: number; k0: number }> = {
  // E = 2.42 < V0 = 4 — classically forbidden, yet part of it gets through
  tunnel: { V0: 4, w: 1.6, k0: 2.2 },
  // E ≈ V0 — the classical "just barely makes it" case is not sharp at all
  'at-threshold': { V0: 4, w: 1.6, k0: 2.83 },
  // E > V0 with k'w = π: the two barrier edges reflect out of phase and cancel.
  // V0 = w = 2 is deliberate. A taller/wider barrier puts the n=1 resonance at a
  // smaller E − V0, which makes it *narrower in energy* than the packet's own
  // spread — the measured T then averages down to ~0.67 and stops looking like
  // "transparent" at all. This one is broad enough to survive the packet.
  resonance: { V0: 2, w: 2, k0: 2.5431 },
  // very thin, very tall — thickness matters more than height
  'thin-barrier': { V0: 9, w: 0.45, k0: 2 },
};

export class TunnelingScene extends Canvas2DBase {
  private V0 = PRESETS.tunnel.V0;
  private barrierW = PRESETS.tunnel.w;
  private k0 = PRESETS.tunnel.k0;
  private preset: TunnelPresetId | null = 'tunnel';

  private readonly x = new Float64Array(N);
  private readonly k = fftFreqs(N, DX);
  private readonly V = new Float64Array(N);
  private readonly mask = new Float64Array(N);
  private readonly re = new Float64Array(N);
  private readonly im = new Float64Array(N);
  private readonly prob = new Float64Array(N);

  private absorbedLeft = 0;
  private absorbedRight = 0;
  private t = 0;
  private running = true;
  private finished = false;

  private rafId: number | null = null;
  private readonly onStats?: (s: TunnelStats) => void;

  constructor(options: TunnelingSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    for (let i = 0; i < N; i++) this.x[i] = X_MIN + i * DX;
    this.buildMask();
    this.reset();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    super.destroy();
  }

  // ─────────────────────────────────────────── setup

  private buildMask(): void {
    const xAbsL = X_MIN + ABSORB_MARGIN;
    const xAbsR = X_MAX - ABSORB_MARGIN;
    for (let i = 0; i < N; i++) {
      const xi = this.x[i];
      let m = 1;
      if (xi < xAbsL) m = Math.cos((Math.PI / 2) * ((xAbsL - xi) / ABSORB_MARGIN)) ** 0.25;
      else if (xi > xAbsR) m = Math.cos((Math.PI / 2) * ((xi - xAbsR) / ABSORB_MARGIN)) ** 0.25;
      this.mask[i] = Math.max(0, Math.min(1, m));
    }
  }

  private buildPotential(): void {
    const half = this.barrierW / 2;
    for (let i = 0; i < N; i++) {
      this.V[i] = Math.abs(this.x[i]) <= half ? this.V0 : 0;
    }
  }

  public reset(): void {
    this.buildPotential();
    let norm = 0;
    for (let i = 0; i < N; i++) {
      const xi = this.x[i];
      const a = Math.exp(-((xi - START_X) ** 2) / (4 * PACKET_SIGMA * PACKET_SIGMA));
      const ph = this.k0 * xi;
      this.re[i] = a * Math.cos(ph);
      this.im[i] = a * Math.sin(ph);
      norm += a * a * DX;
    }
    const s = 1 / Math.sqrt(norm);
    for (let i = 0; i < N; i++) {
      this.re[i] *= s;
      this.im[i] *= s;
    }
    this.absorbedLeft = 0;
    this.absorbedRight = 0;
    this.t = 0;
    this.finished = false;
    this.updateProb();
    this.emit();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── evolution

  private halfPotentialStep(): void {
    const h = -DT / 2;
    for (let i = 0; i < N; i++) {
      const ang = this.V[i] * h;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const r = this.re[i];
      const m = this.im[i];
      this.re[i] = r * c - m * s;
      this.im[i] = r * s + m * c;
    }
  }

  private kineticStep(): void {
    fft(this.re, this.im);
    for (let i = 0; i < N; i++) {
      const ang = -(this.k[i] * this.k[i]) * 0.5 * DT;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const r = this.re[i];
      const m = this.im[i];
      this.re[i] = r * c - m * s;
      this.im[i] = r * s + m * c;
    }
    ifft(this.re, this.im);
  }

  /** Apply the sponge and book the removed probability to the correct side. */
  private absorb(): void {
    for (let i = 0; i < N; i++) {
      const m = this.mask[i];
      if (m === 1) continue;
      const before = (this.re[i] ** 2 + this.im[i] ** 2) * DX;
      this.re[i] *= m;
      this.im[i] *= m;
      const after = (this.re[i] ** 2 + this.im[i] ** 2) * DX;
      const lost = before - after;
      if (this.x[i] < 0) this.absorbedLeft += lost;
      else this.absorbedRight += lost;
    }
  }

  private step(): void {
    this.halfPotentialStep();
    this.kineticStep();
    this.halfPotentialStep();
    this.absorb();
    this.t += DT;
  }

  private updateProb(): void {
    for (let i = 0; i < N; i++) this.prob[i] = this.re[i] ** 2 + this.im[i] ** 2;
  }

  // ─────────────────────────────────────────── measurement

  private partition(): { R: number; T: number; inside: number; norm: number } {
    const half = this.barrierW / 2;
    let left = 0;
    let right = 0;
    let inside = 0;
    for (let i = 0; i < N; i++) {
      const p = this.prob[i] * DX;
      const xi = this.x[i];
      if (xi < -half) left += p;
      else if (xi > half) right += p;
      else inside += p;
    }
    return {
      R: left + this.absorbedLeft,
      T: right + this.absorbedRight,
      inside,
      norm: left + right + inside + this.absorbedLeft + this.absorbedRight,
    };
  }

  /** Plane-wave transmission through a rectangular barrier at the packet's centre energy. */
  private analyticT(): number {
    const E = (this.k0 * this.k0) / 2;
    const V0 = this.V0;
    const w = this.barrierW;
    if (V0 <= 0) return 1;
    if (Math.abs(E - V0) < 1e-6) return 1 / (1 + (w * w * V0) / 2);
    if (E < V0) {
      const kappa = Math.sqrt(2 * (V0 - E));
      const sh = Math.sinh(kappa * w);
      return 1 / (1 + (V0 * V0 * sh * sh) / (4 * E * (V0 - E)));
    }
    const kp = Math.sqrt(2 * (E - V0));
    const sn = Math.sin(kp * w);
    return 1 / (1 + (V0 * V0 * sn * sn) / (4 * E * (E - V0)));
  }

  private emit(): void {
    if (!this.onStats) return;
    const p = this.partition();
    this.onStats({
      time: this.t,
      energy: (this.k0 * this.k0) / 2,
      // Δp = 1/(2σ) for this packet, so ΔE ≈ k₀·Δp
      energySpread: this.k0 / (2 * PACKET_SIGMA),
      barrierHeight: this.V0,
      barrierWidth: this.barrierW,
      k0: this.k0,
      reflection: p.R,
      transmission: p.T,
      inside: p.inside,
      analyticT: this.analyticT(),
      norm: p.norm,
      running: this.running,
      finished: this.finished,
      preset: this.preset,
    });
  }

  // ─────────────────────────────────────────── controls

  public applyPreset(id: TunnelPresetId): void {
    const p = PRESETS[id];
    this.V0 = p.V0;
    this.barrierW = p.w;
    this.k0 = p.k0;
    this.preset = id;
    this.reset();
  }

  public setV0(v: number): void { this.V0 = v; this.preset = null; this.reset(); }
  public setBarrierWidth(w: number): void { this.barrierW = w; this.preset = null; this.reset(); }
  public setK0(k: number): void { this.k0 = k; this.preset = null; this.reset(); }

  public toggle(): void {
    this.running = !this.running;
    this.emit();
  }

  // ─────────────────────────────────────────── loop + draw

  private loop(): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.running || this.finished) return;
    for (let i = 0; i < STEPS_PER_FRAME; i++) this.step();
    this.updateProb();

    // stop once essentially nothing is left near the barrier — the numbers
    // have converged and running on just burns battery
    const p = this.partition();
    if (this.t > 6 && p.inside < 1e-6) {
      let nearBarrier = 0;
      for (let i = 0; i < N; i++) {
        if (Math.abs(this.x[i]) < 45) nearBarrier += this.prob[i] * DX;
      }
      if (nearBarrier < 2e-4) this.finished = true;
    }
    this.scheduleRender();
    this.emit();
  }

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const gap = 8;
    const insetH = Math.max(90, this.height * 0.27);
    this.drawMain(this.height - insetH - gap);
    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.height - insetH - gap / 2);
    ctx.lineTo(this.width, this.height - insetH - gap / 2);
    ctx.stroke();
    this.drawBarrierInset(this.height - insetH, insetH);
  }

  /**
   * The barrier is ~1% of a 160-unit-wide box, so the thing the lesson asks the
   * reader to look at — ψ decaying instead of oscillating *inside* the wall —
   * is invisible in the main view. This panel magnifies just that region, with
   * |ψ|² rescaled to its own local maximum (stated on the panel, since a
   * rescaled curve that does not say so is a lie about amplitude).
   */
  private drawBarrierInset(oy: number, h: number): void {
    const ctx = this.ctx;
    const padL = 46;
    const padR = 16;
    const padT = 14;
    const padB = 16;
    const pw = this.width - padL - padR;
    const ph = h - padT - padB;
    const baseY = oy + padT + ph;

    const half = this.barrierW / 2;
    const xr = Math.max(this.barrierW * 1.9, 2.5);
    const toX = (xv: number) => padL + ((xv + xr) / (2 * xr)) * pw;

    // local peak over the window only
    let peak = 0;
    let anyInWindow = false;
    for (let i = 0; i < N; i++) {
      if (Math.abs(this.x[i]) <= xr) {
        peak = Math.max(peak, this.prob[i]);
        anyInWindow = true;
      }
    }
    let globalPeak = 0;
    for (let i = 0; i < N; i++) globalPeak = Math.max(globalPeak, this.prob[i]);

    ctx.fillStyle = 'rgba(181,137,0,0.18)';
    ctx.fillRect(toX(-half), oy + padT, toX(half) - toX(-half), ph);
    ctx.strokeStyle = 'rgba(181,137,0,0.8)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(toX(-half), oy + padT, toX(half) - toX(-half), ph);

    if (anyInWindow && peak > 0) {
      const toY = (p: number) => baseY - (p / peak) * ph * 0.9;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < N; i++) {
        if (Math.abs(this.x[i]) > xr) continue;
        const px = toX(this.x[i]);
        const py = toY(this.prob[i]);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#2aa198';
      ctx.lineWidth = 2;
      ctx.stroke();

      let amp = 0;
      for (let i = 0; i < N; i++) if (Math.abs(this.x[i]) <= xr) amp = Math.max(amp, Math.abs(this.re[i]));
      if (amp > 0) {
        ctx.beginPath();
        started = false;
        for (let i = 0; i < N; i++) {
          if (Math.abs(this.x[i]) > xr) continue;
          const px = toX(this.x[i]);
          const py = oy + padT + ph / 2 - (this.re[i] / amp) * (ph / 2) * 0.85;
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(38,139,210,0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(padL + pw, baseY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('🔍 障礙區放大（|ψ|² 依此窗自行縮放）', padL + 2, oy + 2);
    ctx.textAlign = 'right';
    const rel = globalPeak > 0 && peak > 0 ? peak / globalPeak : 0;
    ctx.fillText(
      rel > 0 ? `此處峰值 = 全域峰值的 ${(rel * 100).toFixed(2)}%` : '此處無機率密度',
      padL + pw,
      oy + 2,
    );
  }

  private drawMain(mainH: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = mainH;

    const padL = 46;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const baseY = padT + ph;

    // energy axis: keep the barrier and E line on screen with headroom
    const eMax = Math.max(this.V0, (this.k0 * this.k0) / 2) * 1.45 + 0.5;
    const toX = (xv: number) => padL + ((xv - X_MIN) / (X_MAX - X_MIN)) * pw;
    const toEnergyY = (e: number) => baseY - (e / eMax) * ph;

    // absorbing regions
    ctx.fillStyle = 'rgba(88,110,117,0.14)';
    ctx.fillRect(toX(X_MIN), padT, toX(X_MIN + ABSORB_MARGIN) - toX(X_MIN), ph);
    ctx.fillRect(toX(X_MAX - ABSORB_MARGIN), padT, toX(X_MAX) - toX(X_MAX - ABSORB_MARGIN), ph);

    // barrier
    const half = this.barrierW / 2;
    const bx0 = toX(-half);
    const bx1 = toX(half);
    ctx.fillStyle = 'rgba(181,137,0,0.28)';
    ctx.fillRect(bx0, toEnergyY(this.V0), Math.max(1, bx1 - bx0), baseY - toEnergyY(this.V0));
    ctx.strokeStyle = '#b58900';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx0, baseY);
    ctx.lineTo(bx0, toEnergyY(this.V0));
    ctx.lineTo(bx1, toEnergyY(this.V0));
    ctx.lineTo(bx1, baseY);
    ctx.stroke();

    // energy of the packet
    const E = (this.k0 * this.k0) / 2;
    ctx.strokeStyle = '#dc322f';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padL, toEnergyY(E));
    ctx.lineTo(padL + pw, toEnergyY(E));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#dc322f';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`E = ${E.toFixed(2)}`, padL + 4, toEnergyY(E) - 3);
    ctx.fillStyle = '#b58900';
    ctx.textAlign = 'right';
    ctx.fillText(`V₀ = ${this.V0.toFixed(2)}`, padL + pw - 4, toEnergyY(this.V0) - 3);

    // |ψ|², drawn on its own scale so it stays readable next to the energy axis
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, this.prob[i]);
    const psiH = ph * 0.55;
    const toPsiY = (p: number) => baseY - (p / (peak || 1)) * psiH;

    ctx.beginPath();
    ctx.moveTo(toX(this.x[0]), baseY);
    for (let i = 0; i < N; i++) ctx.lineTo(toX(this.x[i]), toPsiY(this.prob[i]));
    ctx.lineTo(toX(this.x[N - 1]), baseY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(42,161,152,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = toX(this.x[i]);
      const py = toPsiY(this.prob[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Re ψ, faint — makes the wavelength change inside the barrier visible
    let amp = 0;
    for (let i = 0; i < N; i++) amp = Math.max(amp, Math.abs(this.re[i]));
    ctx.strokeStyle = 'rgba(38,139,210,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = toX(this.x[i]);
      const py = baseY - psiH / 2 - (this.re[i] / (amp || 1)) * (psiH / 2) * 0.9;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // axes
    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(padL + pw, baseY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let xv = -80; xv <= 80; xv += 20) ctx.fillText(`${xv}`, toX(xv), baseY + 5);
    ctx.textAlign = 'left';
    ctx.fillText(`t = ${this.t.toFixed(2)}`, padL + 2, padT - 12 + 12);
    ctx.textAlign = 'right';
    ctx.fillText('位置 x', padL + pw, baseY + 5);

    if (this.finished) {
      ctx.fillStyle = 'rgba(133,153,0,0.9)';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('✓ 波包已離開，R 與 T 已收斂', padL + pw / 2, padT + 2);
    }
  }
}
