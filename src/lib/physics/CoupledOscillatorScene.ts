/**
 * CoupledOscillatorScene — two masses, three springs, one eigenvalue problem.
 *
 * wall —k— m —kc— m —k— wall
 *
 * The equations of motion are ẍ = −(1/m) K x with
 *   K = [[k+kc, −kc], [−kc, k+kc]]
 * whose eigenvectors are (1,1)/√2 and (1,−1)/√2 — the *normal modes*. In
 * those coordinates the system is two independent harmonic oscillators, which
 * is the whole point of the page: diagonalising K is not a trick, it is the
 * act of finding the coordinates in which the masses stop talking to each
 * other.
 *
 * Because the system is linear and starts from rest, the exact solution is
 *   q_i(t) = q_i(0) cos(ω_i t),   x = (q1 v1 + q2 v2)
 * so there is NO integrator here and no accumulated error — every pixel of
 * the trace is evaluated in closed form at its own t. That also means the
 * trace panel needs no history buffer: for a scrolling window we simply
 * evaluate the formula at each column's timestamp.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

const SQRT1_2 = Math.SQRT1_2;
/** Seconds of history shown in the trace panel. */
const TRACE_WINDOW = 24;
/** Displacement (in metres, arbitrary) that maps to the full drawing amplitude. */
const REF_AMPLITUDE = 1;

export type OscPresetId = 'in-phase' | 'anti-phase' | 'push-one' | 'mixed';

export interface OscStats {
  omega1: number;
  omega2: number;
  ratio: number;
  beatPeriod: number | null;
  q1: number;
  q2: number;
  modeEnergy1: number;
  modeEnergy2: number;
  localEnergy1: number;
  localEnergy2: number;
  x1: number;
  x2: number;
  time: number;
  running: boolean;
  preset: OscPresetId;
}

export interface CoupledOscillatorOptions extends Canvas2DBaseOptions {
  onStats?: (s: OscStats) => void;
}

interface Initial {
  x1: number;
  x2: number;
}

const PRESET_INITIALS: Record<OscPresetId, Initial> = {
  // pure mode 1: both masses displaced the same way — the coupling spring is
  // never stretched, so kc does not appear in ω1 at all
  'in-phase': { x1: 0.7, x2: 0.7 },
  // pure mode 2: opposite displacements — the coupling spring works hardest
  'anti-phase': { x1: 0.7, x2: -0.7 },
  // equal parts of both modes — the textbook beat
  'push-one': { x1: 0.9, x2: 0 },
  // lopsided mixture, so neither the pure-mode nor the clean-beat story fits
  'mixed': { x1: 0.85, x2: 0.25 },
};

export class CoupledOscillatorScene extends Canvas2DBase {
  private k = 1.6;
  private kc = 0.45;
  private mass = 1;
  private speed = 1;
  private preset: OscPresetId = 'push-one';
  private initial: Initial = { ...PRESET_INITIALS['push-one'] };

  private t = 0;
  private running = true;
  private lastFrame = 0;
  private rafId: number | null = null;
  private readonly onStats?: (s: OscStats) => void;

  constructor(options: CoupledOscillatorOptions) {
    super(options);
    this.onStats = options.onStats;
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    super.destroy();
  }

  // ─────────────────────────────────────────────── physics

  private get omega1(): number {
    return Math.sqrt(this.k / this.mass);
  }

  private get omega2(): number {
    return Math.sqrt((this.k + 2 * this.kc) / this.mass);
  }

  /** Modal amplitudes at t = 0 (velocities start at zero, so these are it). */
  private get q0(): { q1: number; q2: number } {
    return {
      q1: (this.initial.x1 + this.initial.x2) * SQRT1_2,
      q2: (this.initial.x1 - this.initial.x2) * SQRT1_2,
    };
  }

  /** Exact displacement of both masses at time `t`. */
  private displacementAt(t: number): { x1: number; x2: number } {
    const { q1, q2 } = this.q0;
    const a = q1 * Math.cos(this.omega1 * t);
    const b = q2 * Math.cos(this.omega2 * t);
    return { x1: (a + b) * SQRT1_2, x2: (a - b) * SQRT1_2 };
  }

  private velocityAt(t: number): { v1: number; v2: number } {
    const { q1, q2 } = this.q0;
    const a = -q1 * this.omega1 * Math.sin(this.omega1 * t);
    const b = -q2 * this.omega2 * Math.sin(this.omega2 * t);
    return { v1: (a + b) * SQRT1_2, v2: (a - b) * SQRT1_2 };
  }

  /**
   * Envelope of mass 1 / mass 2, exact for zero initial velocity: the motion
   * is the sum of two cosines, so the analytic-signal magnitude
   * √(q1² + q2² ± 2 q1 q2 cos Δω t) / √2 bounds it tightly.
   */
  private envelopeAt(t: number, mass: 1 | 2): number {
    const { q1, q2 } = this.q0;
    const dw = (this.omega2 - this.omega1) * t;
    const cross = 2 * q1 * q2 * Math.cos(dw) * (mass === 1 ? 1 : -1);
    return Math.sqrt(Math.max(0, q1 * q1 + q2 * q2 + cross)) * SQRT1_2;
  }

  /**
   * Energy stored in each normal mode: E_i = ½m(q̇_i² + ω_i² q_i²).
   * Constant in time — that is the observable payoff of diagonalising.
   */
  private modeEnergies(): { e1: number; e2: number } {
    const { q1, q2 } = this.q0;
    const w1 = this.omega1;
    const w2 = this.omega2;
    return {
      e1: 0.5 * this.mass * w1 * w1 * q1 * q1,
      e2: 0.5 * this.mass * w2 * w2 * q2 * q2,
    };
  }

  /**
   * Per-mass "local" energy. The coupling term ½kc(x1−x2)² belongs to neither
   * mass, so it is split evenly — a convention, not a law, and the page says
   * so. What matters is that these two sloshes while the modal pair above
   * does not.
   */
  private localEnergies(t: number): { e1: number; e2: number } {
    const { x1, x2 } = this.displacementAt(t);
    const { v1, v2 } = this.velocityAt(t);
    const shared = 0.25 * this.kc * (x1 - x2) * (x1 - x2);
    return {
      e1: 0.5 * this.mass * v1 * v1 + 0.5 * this.k * x1 * x1 + shared,
      e2: 0.5 * this.mass * v2 * v2 + 0.5 * this.k * x2 * x2 + shared,
    };
  }

  // ─────────────────────────────────────────────── controls

  public setPreset(id: OscPresetId): void {
    this.preset = id;
    this.initial = { ...PRESET_INITIALS[id] };
    this.t = 0;
    this.emit();
    this.scheduleRender();
  }

  public setK(v: number): void { this.k = v; this.t = 0; this.emit(); this.scheduleRender(); }
  public setKc(v: number): void { this.kc = v; this.t = 0; this.emit(); this.scheduleRender(); }
  public setMass(v: number): void { this.mass = v; this.t = 0; this.emit(); this.scheduleRender(); }
  public setSpeed(v: number): void { this.speed = v; }

  public toggle(): void {
    this.running = !this.running;
    this.lastFrame = 0;
    this.emit();
  }

  public reset(): void {
    this.t = 0;
    this.emit();
    this.scheduleRender();
  }

  private emit(): void {
    if (!this.onStats) return;
    const { q1, q2 } = this.q0;
    const modes = this.modeEnergies();
    const local = this.localEnergies(this.t);
    const { x1, x2 } = this.displacementAt(this.t);
    const dw = this.omega2 - this.omega1;
    this.onStats({
      omega1: this.omega1,
      omega2: this.omega2,
      ratio: this.omega2 / this.omega1,
      beatPeriod: dw > 1e-9 ? (2 * Math.PI) / dw : null,
      q1, q2,
      modeEnergy1: modes.e1,
      modeEnergy2: modes.e2,
      localEnergy1: local.e1,
      localEnergy2: local.e2,
      x1, x2,
      time: this.t,
      running: this.running,
      preset: this.preset,
    });
  }

  // ─────────────────────────────────────────────── loop

  private loop(now: number): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.lastFrame === 0) this.lastFrame = now;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.running) {
      this.t += dt * this.speed;
      this.scheduleRender();
      this.emit();
    }
  }

  // ─────────────────────────────────────────────── drawing

  private springPath(x0: number, x1: number, y: number, coils: number, amp: number): void {
    const ctx = this.ctx;
    const span = x1 - x0;
    const lead = Math.min(12, Math.abs(span) * 0.15);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + lead, y);
    const zigStart = x0 + lead;
    const zigSpan = span - 2 * lead;
    const steps = coils * 2;
    for (let i = 1; i <= steps; i++) {
      const px = zigStart + (zigSpan * i) / steps;
      const py = y + (i % 2 === 0 ? 0 : i % 4 === 1 ? -amp : amp);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x1 - lead, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }

  protected draw(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, W, H);

    const mechH = Math.max(120, H * 0.42);
    this.drawMechanism(0, 0, W, mechH);
    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mechH);
    ctx.lineTo(W, mechH);
    ctx.stroke();
    this.drawTraces(0, mechH, W, H - mechH);
  }

  private drawMechanism(ox: number, oy: number, w: number, h: number): void {
    const ctx = this.ctx;
    const padX = 34;
    const y = oy + h * 0.56;
    const left = ox + padX;
    const right = ox + w - padX;
    const span = right - left;
    // three springs and two masses: |--s--[m1]--s--[m2]--s--|
    const blockW = Math.min(58, span * 0.13);
    const rest1 = left + span * 0.3;
    const rest2 = left + span * 0.7;
    const scale = Math.min(span * 0.16, 70) / REF_AMPLITUDE;

    const { x1, x2 } = this.displacementAt(this.t);
    const p1 = rest1 + x1 * scale;
    const p2 = rest2 + x2 * scale;

    // walls
    ctx.fillStyle = 'rgba(88,110,117,0.55)';
    ctx.fillRect(left - 12, y - h * 0.3, 12, h * 0.6);
    ctx.fillRect(right, y - h * 0.3, 12, h * 0.6);
    ctx.strokeStyle = 'rgba(147,161,161,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const hy = y - h * 0.3 + (h * 0.6 * i) / 5;
      ctx.beginPath();
      ctx.moveTo(left - 20, hy + 6); ctx.lineTo(left - 12, hy);
      ctx.moveTo(right + 12, hy); ctx.lineTo(right + 20, hy + 6);
      ctx.stroke();
    }

    // equilibrium markers
    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.setLineDash([3, 4]);
    for (const rx of [rest1, rest2]) {
      ctx.beginPath();
      ctx.moveTo(rx, y - h * 0.34);
      ctx.lineTo(rx, y + h * 0.34);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // springs — the coupling one is highlighted because kc is the slider that
    // actually changes the physics
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(147,161,161,0.8)';
    this.springPath(left, p1 - blockW / 2, y, 7, 9);
    this.springPath(p2 + blockW / 2, right, y, 7, 9);
    ctx.strokeStyle = '#b58900';
    ctx.lineWidth = 2.4;
    this.springPath(p1 + blockW / 2, p2 - blockW / 2, y, 8, 11);

    // masses
    const blocks: [number, string, string][] = [
      [p1, '#268bd2', 'm₁'],
      [p2, '#d33682', 'm₂'],
    ];
    for (const [px, color, label] of blocks) {
      const bh = blockW * 0.86;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(253,246,227,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px - blockW / 2, y - bh / 2, blockW, bh, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fdf6e3';
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, y);
    }

    ctx.fillStyle = 'rgba(147,161,161,0.75)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('耦合彈簧 k_c', (p1 + p2) / 2, y - blockW * 0.62);
  }

  private drawTraces(ox: number, oy: number, w: number, h: number): void {
    const ctx = this.ctx;
    const padL = 40;
    const padR = 14;
    const padT = 14;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const x0 = ox + padL;
    const y0 = oy + padT;
    const midY = y0 + plotH / 2;

    const { q1, q2 } = this.q0;
    const maxAmp = Math.max(0.15, (Math.abs(q1) + Math.abs(q2)) * SQRT1_2);
    const yScale = (plotH / 2) * 0.88 / maxAmp;

    const tEnd = this.t;
    const tStart = Math.max(0, tEnd - TRACE_WINDOW);
    const tSpan = Math.max(1e-6, tEnd - tStart);
    const toX = (t: number) => x0 + ((t - tStart) / tSpan) * plotW;

    // zero line + frame
    ctx.strokeStyle = 'rgba(88,110,117,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, midY);
    ctx.lineTo(x0 + plotW, midY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('位移', x0 - 6, midY);

    const cols = Math.max(2, Math.floor(plotW));
    const traces: [1 | 2, string][] = [[1, '#268bd2'], [2, '#d33682']];

    // beat envelopes first, so the traces sit on top
    for (const [which, color] of traces) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      for (const sgn of [1, -1]) {
        ctx.beginPath();
        for (let j = 0; j <= cols; j++) {
          const t = tStart + (tSpan * j) / cols;
          const e = this.envelopeAt(t, which) * sgn;
          const px = toX(t);
          const py = midY - e * yScale;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    for (const [which, color] of traces) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let j = 0; j <= cols; j++) {
        const t = tStart + (tSpan * j) / cols;
        const d = this.displacementAt(t);
        const v = which === 1 ? d.x1 : d.x2;
        const px = toX(t);
        const py = midY - v * yScale;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // playhead
    ctx.strokeStyle = 'rgba(253,246,227,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + plotW, y0);
    ctx.lineTo(x0 + plotW, y0 + plotH);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`t = ${this.t.toFixed(1)} s`, x0 + 4, y0 + plotH + 4);
    ctx.textAlign = 'right';
    ctx.fillText(`← ${TRACE_WINDOW}s 視窗 →`, x0 + plotW, y0 + plotH + 4);
  }
}
