/**
 * IsingScene — 2D Ising model on a periodic L×L lattice, sampled with
 * Metropolis. Two canvases: the lattice itself, and the ⟨|M|⟩–T curve the
 * user builds up by running the experiment.
 *
 * Two things this file is careful about:
 *
 * 1. It is the *same* algorithm as /math/probstat/markov — propose a move,
 *    accept with min(1, e^{−ΔE/T}). Nothing here is Ising-specific except the
 *    energy function, which is why the page can point back at that lesson.
 *
 * 2. Measuring ⟨|M|⟩ honestly needs equilibration. The auto-sweep runs
 *    EQUIL_SWEEPS at each temperature *before* it starts averaging, and it
 *    does this as a frame-by-frame state machine so the tab never locks up.
 *    Reading |M| off a lattice that has not settled is the classic way to get
 *    a phase-transition plot that lies.
 *
 * Rendering goes through an offscreen L×L ImageData scaled up with smoothing
 * off: one putImageData + one drawImage per frame instead of L² fillRects.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

/** Onsager's exact critical temperature for the square lattice at J = 1. */
export const T_CRITICAL = 2 / Math.log(1 + Math.SQRT2);

const L = 96;
const N = L * L;
const J = 1;
const UP_COLOR: [number, number, number] = [203, 75, 22];   // accent-orange
const DOWN_COLOR: [number, number, number] = [22, 82, 120]; // deep blue

const EQUIL_SWEEPS = 60;
const MEASURE_SWEEPS = 80;
const SWEEP_T_HIGH = 3.6;
const SWEEP_T_LOW = 1.2;
const SWEEP_STEPS = 25;

export interface IsingStats {
  temperature: number;
  magnetization: number;
  energyPerSite: number;
  acceptRate: number;
  sweeps: number;
  running: boolean;
  sweepPhase: 'idle' | 'equilibrating' | 'measuring';
  sweepProgress: number;
  curvePoints: number;
}

export interface IsingSceneOptions extends Canvas2DBaseOptions {
  chartCanvasId: string;
  onStats?: (s: IsingStats) => void;
}

interface CurvePoint {
  T: number;
  m: number;
}

export class IsingScene extends Canvas2DBase {
  private spins = new Int8Array(N);
  private temperature = 2.6;
  private sweepsPerFrame = 4;
  private running = true;

  /** Σs — an exact integer. Re-deriving it from a float ratio each sweep
   *  would accumulate rounding over the thousands of sweeps a run does. */
  private magSum = 0;
  private energy = 0; // total, not per site
  private sweeps = 0;
  private accepted = 0;
  private attempted = 0;

  /** exp(−ΔE/T) lookup, indexed by (s·neighbourSum + 4) / 2 → 0…4. */
  private boltzmann = new Float64Array(5);

  private buffer: HTMLCanvasElement;
  private bufferCtx: CanvasRenderingContext2D;
  private image: ImageData;

  private chart: MagnetizationChart;
  private curve: CurvePoint[] = [];

  private autoSweep: {
    step: number;
    phase: 'equilibrating' | 'measuring';
    sweepsDone: number;
    mSum: number;
    mCount: number;
  } | null = null;

  private rafId: number | null = null;
  private readonly onStats?: (s: IsingStats) => void;
  private rngState = 0x9e3779b9;

  constructor(options: IsingSceneOptions) {
    super(options);
    this.onStats = options.onStats;

    const buf = document.createElement('canvas');
    buf.width = L;
    buf.height = L;
    const bctx = buf.getContext('2d');
    if (!bctx) throw new Error('Could not create the Ising offscreen context');
    this.buffer = buf;
    this.bufferCtx = bctx;
    this.image = bctx.createImageData(L, L);

    this.chart = new MagnetizationChart({ canvasId: options.chartCanvasId });

    this.randomize();
    this.updateBoltzmann();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.chart.destroy();
    super.destroy();
  }

  // ─────────────────────────────────────────── rng (deterministic mulberry32)

  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ─────────────────────────────────────────── lattice

  public randomize(): void {
    for (let i = 0; i < N; i++) this.spins[i] = this.random() < 0.5 ? 1 : -1;
    this.afterReset();
  }

  public alignUp(): void {
    this.spins.fill(1);
    this.afterReset();
  }

  private afterReset(): void {
    this.sweeps = 0;
    this.accepted = 0;
    this.attempted = 0;
    this.recompute();
    this.scheduleRender();
    this.emit();
  }

  /** Full O(N) recount — only on reset, never inside the Metropolis loop. */
  private recompute(): void {
    let m = 0;
    let e = 0;
    for (let y = 0; y < L; y++) {
      for (let x = 0; x < L; x++) {
        const s = this.spins[y * L + x];
        m += s;
        // right and down only, so every bond is counted exactly once
        e -= J * s * this.spins[y * L + ((x + 1) % L)];
        e -= J * s * this.spins[((y + 1) % L) * L + x];
      }
    }
    this.magSum = m;
    this.energy = e;
  }

  private get magnetization(): number {
    return this.magSum / N;
  }

  private updateBoltzmann(): void {
    // possible ΔE = 2·J·s·(neighbour sum); s·sum ∈ {−4,−2,0,2,4}
    for (let i = 0; i < 5; i++) {
      const sSum = i * 2 - 4;
      const dE = 2 * J * sSum;
      this.boltzmann[i] = dE <= 0 ? 1 : Math.exp(-dE / this.temperature);
    }
  }

  /** One sweep = N single-spin attempts at uniformly random sites. */
  private sweep(): void {
    const s = this.spins;
    let m = this.magSum;
    let e = this.energy;
    let acc = 0;
    for (let n = 0; n < N; n++) {
      const idx = (this.random() * N) | 0;
      const x = idx % L;
      const y = (idx / L) | 0;
      const sum =
        s[y * L + ((x + 1) % L)] +
        s[y * L + ((x + L - 1) % L)] +
        s[((y + 1) % L) * L + x] +
        s[((y + L - 1) % L) * L + x];
      const si = s[idx];
      const prod = si * sum; // ∈ {−4,−2,0,2,4}
      if (prod <= 0 || this.random() < this.boltzmann[(prod + 4) >> 1]) {
        s[idx] = -si;
        m -= 2 * si;
        e += 2 * J * prod;
        acc++;
      }
    }
    this.magSum = m;
    this.energy = e;
    this.accepted += acc;
    this.attempted += N;
    this.sweeps++;
  }

  // ─────────────────────────────────────────── controls

  public setTemperature(T: number): void {
    this.temperature = T;
    this.updateBoltzmann();
    this.emit();
  }

  public setSweepsPerFrame(v: number): void {
    this.sweepsPerFrame = v;
  }

  public toggle(): void {
    this.running = !this.running;
    this.emit();
  }

  /** Record the current lattice as one point on the ⟨|M|⟩–T curve. */
  public recordPoint(): void {
    this.pushCurve(this.temperature, Math.abs(this.magnetization));
  }

  public clearCurve(): void {
    this.curve = [];
    this.chart.setCurve(this.curve);
    this.emit();
  }

  public startAutoSweep(): void {
    this.curve = [];
    this.chart.setCurve(this.curve);
    this.alignUp();
    this.setTemperature(SWEEP_T_HIGH);
    this.autoSweep = { step: 0, phase: 'equilibrating', sweepsDone: 0, mSum: 0, mCount: 0 };
    this.running = true;
    this.emit();
  }

  public stopAutoSweep(): void {
    this.autoSweep = null;
    this.emit();
  }

  private pushCurve(T: number, m: number): void {
    this.curve = [...this.curve, { T, m }].sort((a, b) => a.T - b.T);
    this.chart.setCurve(this.curve);
  }

  private stepAutoSweep(): void {
    const st = this.autoSweep;
    if (!st) return;
    st.sweepsDone++;
    if (st.phase === 'equilibrating') {
      if (st.sweepsDone >= EQUIL_SWEEPS) {
        st.phase = 'measuring';
        st.sweepsDone = 0;
      }
      return;
    }
    st.mSum += Math.abs(this.magnetization);
    st.mCount++;
    if (st.sweepsDone < MEASURE_SWEEPS) return;

    this.pushCurve(this.temperature, st.mSum / st.mCount);
    st.step++;
    if (st.step >= SWEEP_STEPS) {
      this.autoSweep = null;
      return;
    }
    const frac = st.step / (SWEEP_STEPS - 1);
    this.setTemperature(SWEEP_T_HIGH + (SWEEP_T_LOW - SWEEP_T_HIGH) * frac);
    st.phase = 'equilibrating';
    st.sweepsDone = 0;
    st.mSum = 0;
    st.mCount = 0;
  }

  private emit(): void {
    if (!this.onStats) return;
    const st = this.autoSweep;
    this.onStats({
      temperature: this.temperature,
      magnetization: this.magnetization,
      energyPerSite: this.energy / N,
      acceptRate: this.attempted > 0 ? this.accepted / this.attempted : 0,
      sweeps: this.sweeps,
      running: this.running,
      sweepPhase: st ? st.phase : 'idle',
      sweepProgress: st ? st.step / SWEEP_STEPS : 0,
      curvePoints: this.curve.length,
    });
  }

  // ─────────────────────────────────────────── loop + draw

  private loop(): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.running) return;
    // the auto-sweep needs a bigger per-frame budget or a 25-point curve takes
    // minutes; stepAutoSweep() is a no-op when no sweep is running
    const budget = this.autoSweep ? Math.max(this.sweepsPerFrame, 12) : this.sweepsPerFrame;
    for (let i = 0; i < budget; i++) {
      this.sweep();
      this.stepAutoSweep();
    }
    this.scheduleRender();
    this.emit();
  }

  protected draw(): void {
    const data = this.image.data;
    for (let i = 0; i < N; i++) {
      const c = this.spins[i] === 1 ? UP_COLOR : DOWN_COLOR;
      const o = i * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
    this.bufferCtx.putImageData(this.image, 0, 0);

    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);

    const side = Math.min(this.width, this.height) - 8;
    const ox = (this.width - side) / 2;
    const oy = (this.height - side) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, ox, oy, side, side);
    ctx.imageSmoothingEnabled = true;

    ctx.strokeStyle = 'rgba(88,110,117,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, side - 1, side - 1);

    ctx.fillStyle = 'rgba(4,34,43,0.75)';
    ctx.fillRect(ox + 6, oy + 6, 132, 40);
    ctx.fillStyle = '#93a1a1';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`T = ${this.temperature.toFixed(3)}`, ox + 12, oy + 12);
    ctx.fillText(`${L}×${L} · ${this.sweeps} sweeps`, ox + 12, oy + 28);
  }
}

/**
 * The ⟨|M|⟩ vs T plot. Kept a separate Canvas2DBase so it redraws only when
 * a point is added, not on every lattice frame.
 */
class MagnetizationChart extends Canvas2DBase {
  private curve: CurvePoint[] = [];

  constructor(options: Canvas2DBaseOptions) {
    super(options);
    this.scheduleRender();
  }

  public setCurve(curve: CurvePoint[]): void {
    this.curve = curve;
    this.scheduleRender();
  }

  protected draw(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, W, H);

    const padL = 38;
    const padR = 12;
    const padT = 12;
    const padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const tMin = 1.0;
    const tMax = 3.8;
    const toX = (T: number) => padL + ((T - tMin) / (tMax - tMin)) * pw;
    const toY = (m: number) => padT + (1 - m) * ph;

    ctx.strokeStyle = 'rgba(88,110,117,0.35)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';

    for (let m = 0; m <= 1.001; m += 0.25) {
      const y = toY(m);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pw, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.toFixed(2), padL - 5, y);
    }
    for (let T = 1.0; T <= 3.81; T += 0.5) {
      const x = toX(T);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ph);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(T.toFixed(1), x, padT + ph + 5);
    }

    // Onsager's T_c
    const xc = toX(T_CRITICAL);
    ctx.strokeStyle = '#b58900';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(xc, padT);
    ctx.lineTo(xc, padT + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b58900';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('T_c ≈ 2.269', xc + 4, padT + 2);

    ctx.fillStyle = 'rgba(147,161,161,0.75)';
    ctx.save();
    ctx.translate(11, padT + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟨|M|⟩', 0, 0);
    ctx.restore();

    if (this.curve.length === 0) {
      ctx.fillStyle = 'rgba(147,161,161,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('按「自動掃描溫度」開始建立曲線', padL + pw / 2, padT + ph / 2);
      return;
    }

    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.curve.forEach((p, i) => {
      const x = toX(p.T);
      const y = toY(p.m);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = '#2aa198';
    for (const p of this.curve) {
      ctx.beginPath();
      ctx.arc(toX(p.T), toY(p.m), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
