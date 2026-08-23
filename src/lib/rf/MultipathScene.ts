/**
 * MultipathScene — why signal strength flickers when you move a few centimetres.
 *
 * The receiver adds up one complex phasor per path:
 *
 *   h = Σ aᵢ · e^{ −j 2π Lᵢ / λ }
 *
 * Nothing else. All the famous consequences fall out of that sum:
 *
 *   - move the receiver by λ/2 and a path's phase turns by π, so constructive
 *     becomes destructive — deep fades every half wavelength
 *   - with many scatterers and no dominant path, the real and imaginary parts
 *     are each a sum of many independent terms, so the central limit theorem
 *     makes them Gaussian and |h| Rayleigh-distributed (see /math/probstat/lln-clt)
 *   - keep the direct path and the same sum becomes Rician instead: the fades
 *     get shallower, which is exactly why line of sight is worth paying for
 *   - move at speed v and each path's phase rotates at its own rate — that
 *     spread of rates *is* Doppler spread, and it sets how fast the fading is
 *
 * Amplitudes follow the classical Clarke model: the *geometry decides the
 * phases*, and the scattered rays share a common amplitude scale set by an
 * explicit K-factor (direct power ÷ total scattered power). That split is
 * deliberate and worth stating plainly, because the obvious alternative is
 * worse in both directions:
 *
 *   - deriving each scattered amplitude from 1/(L₁+L₂) makes every reflection
 *     almost as strong as the direct ray, pinning K near 0 dB so the
 *     LOS-versus-NLOS comparison this page is built on shows nothing;
 *   - deriving it from the physically-truer two-spreading law 1/(L₁L₂) lets a
 *     scatterer the receiver happens to pass close to dominate the entire sum,
 *     which starves the central limit theorem of comparable terms and the
 *     envelope stops being Rayleigh at all.
 *
 * K is also the honest choice pedagogically: in the field nobody derives it,
 * they *measure* it, and it is the single number that characterises how deep
 * the fading will be. So it is a slider.
 *
 * Nothing is tuned to make the histogram look Rayleigh — with the direct ray
 * switched off, that falls out of the central limit theorem on its own.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import { mulberry32, wavelengthM } from './radio';

const FIELD_M = 200;
/** Radius of the scatterer ring around the receiver track, metres. */
const SCATTER_RING_M = 52;
/**
 * Two different sampling rates, for two different jobs.
 *
 * STAT_SAMPLES spans the whole 160 m track at ~0.18 m spacing. That is *wider*
 * than λ/2, which is exactly right for the histogram: consecutive samples are
 * then effectively independent draws from the fading distribution, which is
 * what makes the Rayleigh fit meaningful.
 *
 * WINDOW_SAMPLES covers a few metres around the receiver at ~1 cm spacing —
 * about a dozen points per half wavelength. Plotting the statistics array
 * instead would alias the λ/2 ripple into noise and quietly contradict the
 * lesson, which asks the reader to *see* that periodicity.
 */
const STAT_SAMPLES = 900;
const WINDOW_SAMPLES = 640;
const WINDOW_HALF_M = 3.2;
/** Dense sweep used only to find the true depth of the deepest null. */
const FADE_SCAN_SAMPLES = 7000;
const HIST_BINS = 40;

export interface MultipathStats {
  freqMHz: number;
  wavelengthCm: number;
  scatterers: number;
  hasLineOfSight: boolean;
  rxPositionM: number;
  gainDb: number;
  /** deepest fade seen along the track, dB relative to the mean power */
  deepestFadeDb: number;
  coherenceDistanceCm: number;
  speedKmh: number;
  maxDopplerHz: number;
  kFactorSetDb: number;
  /** K-factor in dB: direct-path power over scattered power (−∞ when NLOS) */
  ricianKdB: number | null;
}

export interface MultipathSceneOptions extends Canvas2DBaseOptions {
  statsCanvasId: string;
  onStats?: (s: MultipathStats) => void;
}

interface Scatterer {
  x: number;
  y: number;
  gamma: number;
}

export class MultipathScene extends Canvas2DBase {
  private freqMHz = 923;
  private scattererCount = 8;
  private hasLineOfSight = true;
  private rxPositionM = FIELD_M * 0.55;
  private speedKmh = 5;
  private kFactorDb = 6;
  private seed = 12345;

  private scatterers: Scatterer[] = [];
  private readonly tx = { x: 12, y: FIELD_M * 0.5 };
  private readonly trackY = FIELD_M * 0.72;

  private track = new Float64Array(STAT_SAMPLES);
  private windowTrace = new Float64Array(WINDOW_SAMPLES);
  private histogram = new Float64Array(HIST_BINS);
  private meanPower = 1;
  private deepestFadeDb = 0;

  private histTop = 2.5;
  private moving = false;
  private rafId: number | null = null;
  private lastFrame = 0;
  private stats!: MultipathStats;

  private chart: FadingChart;
  private readonly onStats?: (s: MultipathStats) => void;

  constructor(options: MultipathSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.chart = new FadingChart({ canvasId: options.statsCanvasId });
    this.reseed(this.seed);
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.chart.destroy();
    super.destroy();
  }

  // ─────────────────────────────────────────── model

  /**
   * Scatterers sit on a jittered ring around the receiver's track, which is the
   * classical Clarke geometry for mobile fading rather than an arbitrary
   * scatter of points. It matters: with scatterers strewn uniformly over the
   * whole field, some end up far closer to the receiver than others, a handful
   * of rays dominate the sum, and the central limit theorem never gets enough
   * comparable terms to produce a Rayleigh envelope. A ring keeps the
   * amplitudes within the same order of magnitude, so the statistics converge
   * to the textbook result and the LOS-versus-NLOS comparison actually shows
   * what the lesson claims it shows.
   */
  public reseed(seed: number): void {
    this.seed = seed;
    const rnd = mulberry32(seed);
    const cx = FIELD_M * 0.55;
    const cy = this.trackY;
    this.scatterers = Array.from({ length: 24 }, (_, i) => {
      // stratified angles so a small subset still surrounds the receiver
      const angle = ((i + rnd()) / 24) * Math.PI * 2;
      const radius = SCATTER_RING_M * (0.78 + rnd() * 0.44);
      return {
        x: Math.max(8, Math.min(FIELD_M - 8, cx + Math.cos(angle) * radius)),
        y: Math.max(8, Math.min(FIELD_M - 8, cy + Math.sin(angle) * radius * 0.62)),
        // reflection coefficient: real surfaces are lossy, 0.3–0.8 is typical
        gamma: 0.3 + rnd() * 0.5,
      };
    });
    this.recompute();
  }

  private activeScatterers(): Scatterer[] {
    return this.scatterers.slice(0, this.scattererCount);
  }

  /**
   * Reference amplitude for the direct ray at the middle of the track. Using a
   * fixed reference rather than the instantaneous distance keeps K constant
   * along the track, which is what "this environment has K = 6 dB" means.
   */
  private referenceAmplitude(): number {
    const midX = (20 + (FIELD_M - 20)) / 2;
    return 1 / Math.max(1, Math.hypot(midX - this.tx.x, this.trackY - this.tx.y));
  }

  /** Common amplitude for every scattered ray, from the configured K-factor. */
  private scatterAmplitude(): number {
    const list = this.activeScatterers();
    if (list.length === 0) return 0;
    const a0 = this.referenceAmplitude();
    const totalScatterPower = (a0 * a0) / Math.pow(10, this.kFactorDb / 10);
    const gammaSq = list.reduce((acc, s) => acc + s.gamma * s.gamma, 0);
    return Math.sqrt(totalScatterPower / gammaSq);
  }

  /** Complex channel gain at a receiver x-position on the track. */
  private channelAt(rxX: number): { re: number; im: number; direct: number; scattered: number } {
    const lambda = wavelengthM(this.freqMHz);
    const k = (2 * Math.PI) / lambda;
    const scale = this.scatterAmplitude();
    let re = 0;
    let im = 0;
    let direct = 0;
    let scattered = 0;

    if (this.hasLineOfSight) {
      const L = Math.hypot(rxX - this.tx.x, this.trackY - this.tx.y);
      const a = 1 / Math.max(1, L);
      re += a * Math.cos(-k * L);
      im += a * Math.sin(-k * L);
      direct = a * a;
    }
    for (const s of this.activeScatterers()) {
      // geometry sets the phase; the K-factor sets the amplitude
      const L = Math.hypot(s.x - this.tx.x, s.y - this.tx.y) + Math.hypot(rxX - s.x, this.trackY - s.y);
      const a = s.gamma * scale;
      re += a * Math.cos(-k * L);
      im += a * Math.sin(-k * L);
      scattered += a * a;
    }
    return { re, im, direct, scattered };
  }

  /**
   * Everything that depends on the environment rather than on where the
   * receiver currently stands. Recomputing this on every animation frame would
   * be pure waste — moving the receiver does not move the scatterers.
   */
  private recomputeField(): void {
    const x0 = 20;
    const x1 = FIELD_M - 20;
    let sumP = 0;
    for (let i = 0; i < STAT_SAMPLES; i++) {
      const x = x0 + ((x1 - x0) * i) / (STAT_SAMPLES - 1);
      const c = this.channelAt(x);
      const p = c.re * c.re + c.im * c.im;
      this.track[i] = p;
      sumP += p;
    }
    this.meanPower = sumP / STAT_SAMPLES || 1;

    // the deepest null needs a much finer comb than the statistics do
    let minP = Infinity;
    for (let i = 0; i < FADE_SCAN_SAMPLES; i++) {
      const x = x0 + ((x1 - x0) * i) / (FADE_SCAN_SAMPLES - 1);
      const c = this.channelAt(x);
      minP = Math.min(minP, c.re * c.re + c.im * c.im);
    }
    this.deepestFadeDb = 10 * Math.log10(Math.max(1e-20, minP / this.meanPower));

    this.histogram.fill(0);
    const norm = Math.sqrt(this.meanPower);
    let maxEnv = 0;
    const envs = new Float64Array(STAT_SAMPLES);
    for (let i = 0; i < STAT_SAMPLES; i++) {
      envs[i] = Math.sqrt(this.track[i]) / norm;
      if (envs[i] > maxEnv) maxEnv = envs[i];
    }
    this.histTop = Math.max(2.5, maxEnv);
    for (let i = 0; i < STAT_SAMPLES; i++) {
      const b = Math.min(HIST_BINS - 1, Math.floor((envs[i] / this.histTop) * HIST_BINS));
      this.histogram[b] += 1 / STAT_SAMPLES;
    }
  }

  /** The zoomed window around the receiver, and the reading at its centre. */
  private recomputeWindow(): void {
    for (let i = 0; i < WINDOW_SAMPLES; i++) {
      const x = this.rxPositionM - WINDOW_HALF_M + ((2 * WINDOW_HALF_M) * i) / (WINDOW_SAMPLES - 1);
      const c = this.channelAt(x);
      this.windowTrace[i] = c.re * c.re + c.im * c.im;
    }
  }

  private recompute(): void {
    this.recomputeField();
    this.recomputeWindow();
    this.publish();
  }

  private publish(): void {
    const c = this.channelAt(this.rxPositionM);
    const gain = c.re * c.re + c.im * c.im;
    const lambda = wavelengthM(this.freqMHz);

    this.stats = {
      freqMHz: this.freqMHz,
      wavelengthCm: lambda * 100,
      scatterers: this.scattererCount,
      hasLineOfSight: this.hasLineOfSight,
      rxPositionM: this.rxPositionM,
      gainDb: 10 * Math.log10(Math.max(1e-20, gain / this.meanPower)),
      deepestFadeDb: this.deepestFadeDb,
      coherenceDistanceCm: (lambda / 2) * 100,
      speedKmh: this.speedKmh,
      maxDopplerHz: (this.speedKmh / 3.6) / lambda,
      kFactorSetDb: this.kFactorDb,
      ricianKdB: this.hasLineOfSight && this.scattererCount > 0 ? this.kFactorDb : null,
    };

    this.chart.setData(
      this.windowTrace, this.histogram, this.meanPower, this.histTop,
      this.rxPositionM, WINDOW_HALF_M, this.hasLineOfSight, wavelengthM(this.freqMHz),
    );
    this.onStats?.(this.stats);
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── controls

  public setFrequency(mhz: number): void { this.freqMHz = mhz; this.recompute(); }
  public setScatterers(n: number): void { this.scattererCount = Math.max(0, Math.min(24, Math.round(n))); this.recompute(); }
  public setLineOfSight(on: boolean): void { this.hasLineOfSight = on; this.recompute(); }
  public setRxPosition(m: number): void { this.rxPositionM = m; this.recomputeWindow(); this.publish(); }
  public setSpeed(kmh: number): void { this.speedKmh = kmh; this.recompute(); }
  public setKFactor(db: number): void { this.kFactorDb = db; this.recompute(); }
  public toggleMoving(): void { this.moving = !this.moving; this.lastFrame = 0; }
  public get isMoving(): boolean { return this.moving; }
  public shuffle(): void { this.reseed((this.seed * 1103515245 + 12345) >>> 0); }

  private loop(now: number): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.moving) return;
    if (this.lastFrame === 0) this.lastFrame = now;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    // metres per second, but slowed so the λ/2 ripple is watchable
    const v = (this.speedKmh / 3.6) * 0.25;
    let x = this.rxPositionM + v * dt;
    if (x > FIELD_M - 20) x = 20;
    this.rxPositionM = x;
    this.recomputeWindow();
    this.publish();
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);

    const pad = 18;
    const size = Math.min(this.width - pad * 2, this.height - pad * 2);
    if (size < 40) return;
    const ox = (this.width - size) / 2;
    const oy = (this.height - size) / 2;
    const toPx = (m: number) => (m / FIELD_M) * size;

    ctx.strokeStyle = 'rgba(88,110,117,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, size, size);

    // the track the receiver slides along
    ctx.strokeStyle = 'rgba(88,110,117,0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ox + toPx(20), oy + toPx(this.trackY));
    ctx.lineTo(ox + toPx(FIELD_M - 20), oy + toPx(this.trackY));
    ctx.stroke();
    ctx.setLineDash([]);

    const rxPx = { x: ox + toPx(this.rxPositionM), y: oy + toPx(this.trackY) };
    const txPx = { x: ox + toPx(this.tx.x), y: oy + toPx(this.tx.y) };

    // rays, drawn with an opacity that tracks how much each path contributes
    const lambda = wavelengthM(this.freqMHz);
    const scale = this.scatterAmplitude();
    const a0 = this.referenceAmplitude();
    for (const s of this.activeScatterers()) {
      const sx = ox + toPx(s.x);
      const sy = oy + toPx(s.y);
      const L = Math.hypot(s.x - this.tx.x, s.y - this.tx.y) + Math.hypot(this.rxPositionM - s.x, this.trackY - s.y);
      const a = s.gamma * scale;
      // phase → hue-ish colour so constructive/destructive grouping is visible
      const phase = ((-2 * Math.PI * L) / lambda) % (2 * Math.PI);
      const light = 0.5 + 0.5 * Math.cos(phase);
      ctx.strokeStyle = `rgba(${Math.round(211 * light + 42 * (1 - light))}, ${Math.round(54 * light + 161 * (1 - light))}, ${Math.round(130 * light + 152 * (1 - light))}, ${Math.min(0.8, Math.max(0.15, (a / a0) * 0.9))})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(txPx.x, txPx.y);
      ctx.lineTo(sx, sy);
      ctx.lineTo(rxPx.x, rxPx.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(147,161,161,0.7)';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.hasLineOfSight) {
      ctx.strokeStyle = 'rgba(253,246,227,0.8)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(txPx.x, txPx.y);
      ctx.lineTo(rxPx.x, rxPx.y);
      ctx.stroke();
    }

    // transmitter
    ctx.fillStyle = '#b58900';
    ctx.beginPath();
    ctx.arc(txPx.x, txPx.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // receiver
    ctx.fillStyle = '#2aa198';
    ctx.beginPath();
    ctx.arc(rxPx.x, rxPx.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253,246,227,0.85)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Tx', txPx.x + 9, txPx.y - 4);
    ctx.fillText('Rx', rxPx.x + 9, rxPx.y - 4);
    ctx.fillText(
      `${this.scattererCount} 個反射體 · ${this.hasLineOfSight ? '有直視路徑 (LOS)' : '無直視路徑 (NLOS)'} · λ = ${(lambda * 100).toFixed(1)} cm`,
      ox + 4,
      oy + 4,
    );

    // phasor sum inset, bottom-left
    this.drawPhasors(ox + 10, oy + size - 10, Math.min(150, size * 0.4));
  }

  private drawPhasors(x0: number, y0: number, r: number): void {
    const ctx = this.ctx;
    const cx = x0 + r / 2;
    const cy = y0 - r / 2;
    ctx.fillStyle = 'rgba(4,34,43,0.75)';
    ctx.fillRect(x0 - 4, y0 - r - 4, r + 8, r + 8);
    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 4, y0 - r - 4, r + 8, r + 8);

    const lambda = wavelengthM(this.freqMHz);
    const k = (2 * Math.PI) / lambda;
    const legs: { re: number; im: number; direct: boolean }[] = [];
    if (this.hasLineOfSight) {
      const L = Math.hypot(this.rxPositionM - this.tx.x, this.trackY - this.tx.y);
      const a = 1 / Math.max(1, L);
      legs.push({ re: a * Math.cos(-k * L), im: a * Math.sin(-k * L), direct: true });
    }
    const rayScale = this.scatterAmplitude();
    for (const s of this.activeScatterers()) {
      const L = Math.hypot(s.x - this.tx.x, s.y - this.tx.y) + Math.hypot(this.rxPositionM - s.x, this.trackY - s.y);
      const a = s.gamma * rayScale;
      legs.push({ re: a * Math.cos(-k * L), im: a * Math.sin(-k * L), direct: false });
    }
    let total = 0;
    let sre = 0;
    let sim = 0;
    for (const l of legs) { sre += l.re; sim += l.im; total += Math.hypot(l.re, l.im); }
    const scale = total > 0 ? (r / 2) * 0.88 / total : 1;

    let px = cx;
    let py = cy;
    for (const l of legs) {
      const nx = px + l.re * scale;
      const ny = py - l.im * scale;
      ctx.strokeStyle = l.direct ? 'rgba(253,246,227,0.85)' : 'rgba(211,54,130,0.75)';
      ctx.lineWidth = l.direct ? 1.8 : 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      px = nx;
      py = ny;
    }
    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + sre * scale, cy - sim * scale);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('相量首尾相接', x0, y0 - r - 2);
  }
}

/** |h|² along the track, plus the envelope histogram against Rayleigh. */
class FadingChart extends Canvas2DBase {
  private track = new Float64Array(0);
  private hist = new Float64Array(0);
  private meanPower = 1;
  private histTop = 2.5;
  private rxPositionM = 0;
  private halfWidthM = 3.2;
  private lambdaM = 0.325;
  private los = true;

  constructor(options: Canvas2DBaseOptions) {
    super(options);
    this.scheduleRender();
  }

  public setData(
    track: Float64Array, hist: Float64Array, meanPower: number, histTop: number,
    rxPositionM: number, halfWidthM: number, los: boolean, lambdaM: number,
  ): void {
    this.track = track;
    this.hist = hist;
    this.meanPower = meanPower;
    this.histTop = histTop;
    this.rxPositionM = rxPositionM;
    this.halfWidthM = halfWidthM;
    this.los = los;
    this.lambdaM = lambdaM;
    this.scheduleRender();
  }

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.track.length === 0) return;
    const gap = 12;
    const leftW = this.width * 0.62 - gap;
    this.drawTrack(0, leftW);
    this.drawHistogram(leftW + gap, this.width - leftW - gap);
  }

  private drawTrack(ox: number, w: number): void {
    const ctx = this.ctx;
    const padL = 38;
    const padT = 18;
    const padB = 22;
    const pw = w - padL - 8;
    const ph = this.height - padT - padB;
    if (pw < 40) return;

    const lo = -35;
    const hi = 12;
    const toY = (db: number) => padT + ph - ((Math.max(lo, Math.min(hi, db)) - lo) / (hi - lo)) * ph;

    ctx.strokeStyle = 'rgba(88,110,117,0.25)';
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let db = hi; db >= lo; db -= 10) {
      const y = toY(db);
      ctx.beginPath();
      ctx.moveTo(ox + padL, y);
      ctx.lineTo(ox + padL + pw, y);
      ctx.stroke();
      ctx.fillText(`${db}`, ox + padL - 5, y);
    }

    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < this.track.length; i++) {
      const db = 10 * Math.log10(Math.max(1e-20, this.track[i] / this.meanPower));
      const x = ox + padL + (pw * i) / (this.track.length - 1);
      const y = toY(db);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // the receiver sits at the centre of the window
    const cx = ox + padL + pw / 2;
    ctx.strokeStyle = 'rgba(253,246,227,0.6)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, padT);
    ctx.lineTo(cx, padT + ph);
    ctx.stroke();
    ctx.setLineDash([]);

    // a λ/2 ruler, so the periodicity is not just asserted
    const halfLambdaPx = (this.lambdaM / 2 / (2 * this.halfWidthM)) * pw;
    if (halfLambdaPx > 5) {
      ctx.strokeStyle = 'rgba(181,137,0,0.9)';
      ctx.lineWidth = 1.6;
      const ry = padT + ph - 8;
      ctx.beginPath();
      ctx.moveTo(cx, ry);
      ctx.lineTo(cx + halfLambdaPx, ry);
      ctx.moveTo(cx, ry - 4); ctx.lineTo(cx, ry + 4);
      ctx.moveTo(cx + halfLambdaPx, ry - 4); ctx.lineTo(cx + halfLambdaPx, ry + 4);
      ctx.stroke();
      ctx.fillStyle = '#b58900';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('λ/2', cx + halfLambdaPx + 4, ry + 4);
    }

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`接收機周圍 ±${this.halfWidthM.toFixed(1)} m 的功率剖面（dB，相對平均）`, ox + padL, 2);
    ctx.fillText(`−${this.halfWidthM.toFixed(1)} m`, ox + padL, padT + ph + 4);
    ctx.textAlign = 'right';
    ctx.fillText(`+${this.halfWidthM.toFixed(1)} m`, ox + padL + pw, padT + ph + 4);
  }

  private drawHistogram(ox: number, w: number): void {
    const ctx = this.ctx;
    const padL = 30;
    const padT = 18;
    const padB = 22;
    const pw = w - padL - 10;
    const ph = this.height - padT - padB;
    if (pw < 40 || this.hist.length === 0) return;

    let peak = 0;
    for (const v of this.hist) peak = Math.max(peak, v);

    // Rayleigh pdf for unit mean power: f(r) = 2r·e^{−r²}
    const binW = this.histTop / this.hist.length;
    let theoPeak = 0;
    const theo = new Float64Array(this.hist.length);
    for (let i = 0; i < this.hist.length; i++) {
      const r = (i + 0.5) * binW;
      theo[i] = 2 * r * Math.exp(-r * r) * binW;
      theoPeak = Math.max(theoPeak, theo[i]);
    }
    const top = Math.max(peak, theoPeak) * 1.15;

    ctx.fillStyle = 'rgba(42,161,152,0.5)';
    for (let i = 0; i < this.hist.length; i++) {
      const x = ox + padL + (pw * i) / this.hist.length;
      const bw = pw / this.hist.length;
      const bh = (this.hist[i] / top) * ph;
      ctx.fillRect(x, padT + ph - bh, Math.max(1, bw - 1), bh);
    }

    ctx.strokeStyle = '#b58900';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < theo.length; i++) {
      const x = ox + padL + (pw * (i + 0.5)) / theo.length;
      const y = padT + ph - (theo[i] / top) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88,110,117,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox + padL, padT + ph);
    ctx.lineTo(ox + padL + pw, padT + ph);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('包絡分布 vs Rayleigh', ox + padL, 2);
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = this.los ? 'rgba(181,137,0,0.85)' : 'rgba(133,153,0,0.9)';
    ctx.textBaseline = 'top';
    ctx.fillText(this.los ? '有 LOS → 應偏離 Rayleigh（Rician）' : '無 LOS → 應貼合 Rayleigh', ox + padL, padT + ph + 4);
  }
}
