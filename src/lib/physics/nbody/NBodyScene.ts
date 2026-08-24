/**
 * NBodyScene — the browser layer: two NBodyCore runs, trails, camera,
 * rendering, and the fixed-timestep loop that drives them.
 *
 * The twin run is the point of this page. `main` and `twin` start from the
 * same preset except for a perturbation δ on one coordinate. They are then
 * integrated with *identical* steps, so any difference between them is the
 * dynamics amplifying δ — not numerical noise, not a different frame rate.
 * That is why the loop uses a fixed dt with an accumulator instead of
 * integrating by wall-clock delta: with a variable step the two runs would
 * still share a frame rate, but the run would not be reproducible between
 * machines, and the energy drift would depend on the user's monitor.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../../math/Canvas2DBase';
import { NBodyCore, type BodySnapshot } from './NBodyCore';
import { DivergenceChart, type DivergenceFit } from './DivergenceChart';
import { BODY_COLORS, getPreset, type NBodyPreset } from './presets';

/** Fixed physics step. Small enough for Burrau's close encounters at ε = 0.02. */
const DT = 0.0005;
/** Sim-time units advanced per real second at speed 1×. */
const BASE_RATE = 1;
/** Backlog guard: a stalled tab must not try to catch up 30 s of physics. */
const MAX_STEPS_PER_FRAME = 40000;
const TRAIL_SAMPLE_DT = 0.01;
const INITIAL_SAMPLE_DT = 0.02;
const MAX_SAMPLES = 1600;
const MAX_VIEW_SPAN = 60;
const MIN_VIEW_SPAN = 0.35;
const CAMERA_LERP = 0.08;

export interface NBodyStats {
  time: number;
  energy: number;
  energyDrift: number;
  angularMomentum: number;
  separation: number;
  lambda: number | null;
  saturated: boolean;
  unstable: boolean;
}

export interface BodyLegendEntry {
  color: string;
  label: string;
  mass: number;
}

export interface NBodySceneCallbacks {
  onStats?: (stats: NBodyStats) => void;
  onBodies?: (bodies: BodyLegendEntry[]) => void;
  onRunningChange?: (running: boolean) => void;
}

export interface NBodySceneOptions extends Canvas2DBaseOptions {
  chartCanvasId: string;
  callbacks?: NBodySceneCallbacks;
}

/**
 * Fixed-capacity ring buffer for one body's trail. Plain arrays with shift()
 * would be O(n) per push at 100 pushes/second × 10 bodies.
 */
class Trail {
  private xs: Float32Array;
  private ys: Float32Array;
  private head = 0;
  private length = 0;

  constructor(private capacity: number) {
    this.xs = new Float32Array(capacity);
    this.ys = new Float32Array(capacity);
  }

  push(x: number, y: number): void {
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.head = (this.head + 1) % this.capacity;
    if (this.length < this.capacity) this.length++;
  }

  /** i = 0 is the oldest retained point. */
  x(i: number): number {
    return this.xs[(this.head - this.length + i + this.capacity * 2) % this.capacity];
  }

  y(i: number): number {
    return this.ys[(this.head - this.length + i + this.capacity * 2) % this.capacity];
  }

  get size(): number {
    return this.length;
  }

  clear(): void {
    this.head = 0;
    this.length = 0;
  }
}

export class NBodyScene extends Canvas2DBase {
  private main: NBodyCore;
  private twin: NBodyCore;
  private chart: DivergenceChart;
  private callbacks: NBodySceneCallbacks;

  private preset: NBodyPreset = getPreset('binary');
  private bodyCount = 2;
  private seed = 20260823;

  private speed = 1;
  private delta = 1e-6;
  private softening = 0.01;
  private trailSeconds = 8;
  private showTwin = true;
  private autoFit = true;
  private zoom = 1;

  private running = false;
  private unstable = false;
  private accumulator = 0;
  private trailTimer = 0;
  private sampleTimer = 0;
  private sampleDt = INITIAL_SAMPLE_DT;
  private lastFrameTime = 0;
  private rafId: number | null = null;

  private mainTrails: Trail[] = [];
  private twinTrails: Trail[] = [];
  private times: number[] = [];
  private distances: number[] = [];
  private systemScale = 1;

  private cam = { cx: 0, cy: 0, scale: 100 };
  private camTarget = { cx: 0, cy: 0, scale: 100 };

  private stars: { x: number; y: number; r: number; a: number }[] = [];
  private starW = -1;
  private starH = -1;

  constructor(options: NBodySceneOptions) {
    super(options);
    this.callbacks = options.callbacks ?? {};
    this.chart = new DivergenceChart({ canvasId: options.chartCanvasId });
    this.main = new NBodyCore([], { softening: this.softening });
    this.twin = new NBodyCore([], { softening: this.softening });
    this.loadPreset('binary');
    this.startLoop();
  }

  // ---------------------------------------------------------------- lifecycle

  public loadPreset(id: string): void {
    this.preset = getPreset(id);
    this.softening = this.preset.softening;
    this.rebuild();
  }

  public get presetId(): string {
    return this.preset.id;
  }

  public get currentSoftening(): number {
    return this.softening;
  }

  public get supportsVariableN(): boolean {
    return this.preset.variableN === true;
  }

  public reroll(): void {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.rebuild();
  }

  /** Rebuild both runs from the preset. Everything that changes the physics
   *  goes through here, because a mid-run change would make the energy-drift
   *  baseline and the divergence history meaningless. */
  private rebuild(): void {
    const bodies = this.preset.build({ n: this.bodyCount, seed: this.seed });
    this.main = new NBodyCore(bodies, { softening: this.softening });

    // Perturb one coordinate of the first body by δ — nothing else differs.
    const perturbed = bodies.map((b, i) => (i === 0 ? { ...b, x: b.x + this.delta } : b));
    this.twin = new NBodyCore(perturbed, { softening: this.softening });

    const b = this.main.bounds();
    this.systemScale = Math.max(1e-3, Math.hypot(b.maxX - b.minX, b.maxY - b.minY));

    this.unstable = false;
    this.accumulator = 0;
    this.trailTimer = 0;
    this.sampleTimer = 0;
    this.sampleDt = INITIAL_SAMPLE_DT;
    this.times = [];
    this.distances = [];

    const capacity = this.trailCapacity();
    this.mainTrails = bodies.map(() => new Trail(capacity));
    this.twinTrails = bodies.map(() => new Trail(capacity));
    this.pushTrailSample();

    this.fitCamera(true);
    this.emitBodies();
    this.emitStats();
    this.refreshChart();
    this.scheduleRender();
  }

  private trailCapacity(): number {
    return Math.max(8, Math.round(this.trailSeconds / TRAIL_SAMPLE_DT));
  }

  public play(): void {
    if (this.running || this.unstable) return;
    this.running = true;
    this.lastFrameTime = 0;
    this.callbacks.onRunningChange?.(true);
  }

  public pause(): void {
    if (!this.running) return;
    this.running = false;
    this.callbacks.onRunningChange?.(false);
  }

  public toggle(): void {
    if (this.running) this.pause();
    else this.play();
  }

  public reset(): void {
    this.pause();
    this.rebuild();
  }

  public get isRunning(): boolean {
    return this.running;
  }

  // ------------------------------------------------------------------ setters

  public setBodyCount(n: number): void {
    this.bodyCount = Math.max(2, Math.min(10, Math.round(n)));
    if (this.preset.variableN) this.rebuild();
  }

  public setDelta(delta: number): void {
    this.delta = Math.max(1e-12, delta);
    this.rebuild();
  }

  public setSoftening(eps: number): void {
    this.softening = Math.max(1e-4, eps);
    this.rebuild();
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.05, speed);
  }

  public setTrailSeconds(seconds: number): void {
    this.trailSeconds = Math.max(0.5, seconds);
    const capacity = this.trailCapacity();
    this.mainTrails = this.mainTrails.map(() => new Trail(capacity));
    this.twinTrails = this.twinTrails.map(() => new Trail(capacity));
    this.pushTrailSample();
    this.scheduleRender();
  }

  public setShowTwin(show: boolean): void {
    this.showTwin = show;
    this.scheduleRender();
  }

  public setAutoFit(auto: boolean): void {
    this.autoFit = auto;
    if (auto) this.fitCamera(false);
    this.scheduleRender();
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, zoom);
    this.scheduleRender();
  }

  // -------------------------------------------------------------------- loop

  private startLoop(): void {
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      if (this.lastFrameTime === 0) this.lastFrameTime = now;
      const realDt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = now;

      if (this.running) {
        this.advance(realDt * BASE_RATE * this.speed);
        this.emitStats();
        this.refreshChart();
      }
      if (this.autoFit) this.fitCamera(false);
      this.scheduleRender();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private advance(simDelta: number): void {
    this.accumulator += simDelta;
    let steps = 0;
    while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
      this.main.step(DT);
      this.twin.step(DT);
      this.accumulator -= DT;
      steps++;

      this.trailTimer += DT;
      if (this.trailTimer >= TRAIL_SAMPLE_DT) {
        this.trailTimer = 0;
        this.pushTrailSample();
      }
      this.sampleTimer += DT;
      if (this.sampleTimer >= this.sampleDt) {
        this.sampleTimer = 0;
        this.pushDivergenceSample();
      }
    }
    // Drop any remaining backlog rather than spiralling on a slow frame.
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;

    if (!this.main.isFinite() || !this.twin.isFinite()) {
      this.unstable = true;
      this.pause();
    }
  }

  private pushTrailSample(): void {
    const m = this.main.snapshot();
    const t = this.twin.snapshot();
    for (let i = 0; i < m.length; i++) {
      this.mainTrails[i]?.push(m[i].x, m[i].y);
      this.twinTrails[i]?.push(t[i]?.x ?? m[i].x, t[i]?.y ?? m[i].y);
    }
  }

  private pushDivergenceSample(): void {
    this.times.push(this.main.time);
    this.distances.push(this.main.positionDistanceTo(this.twin));
    if (this.times.length > MAX_SAMPLES) {
      // Keep the full history instead of a sliding window: drop every other
      // point and halve the resolution. The straight-line signature survives.
      this.times = this.times.filter((_, i) => i % 2 === 0);
      this.distances = this.distances.filter((_, i) => i % 2 === 0);
      this.sampleDt *= 2;
    }
  }

  // ------------------------------------------------------------------ metrics

  /**
   * Least-squares slope of ln d vs t over the growth band: above the noise
   * floor of δ itself, below the point where d saturates at the system size.
   * Finite-time estimate — labelled λ̂ on the page, not "the" Lyapunov exponent.
   */
  private estimateLambda(): DivergenceFit | null {
    const lo = this.delta * 8;
    const hi = this.systemScale * 0.5;
    let n = 0;
    let sumT = 0;
    let sumL = 0;
    let sumTT = 0;
    let sumTL = 0;
    let tStart = Infinity;
    let tEnd = -Infinity;

    for (let i = 0; i < this.times.length; i++) {
      const d = this.distances[i];
      if (!(d > lo && d < hi)) continue;
      const t = this.times[i];
      const l = Math.log(d);
      n++;
      sumT += t;
      sumL += l;
      sumTT += t * t;
      sumTL += t * l;
      if (t < tStart) tStart = t;
      if (t > tEnd) tEnd = t;
    }
    if (n < 8) return null;

    const denom = n * sumTT - sumT * sumT;
    if (Math.abs(denom) < 1e-12) return null;
    const lambda = (n * sumTL - sumT * sumL) / denom;
    const intercept = (sumL - lambda * sumT) / n;
    return { lambda, intercept, tStart, tEnd };
  }

  private emitStats(): void {
    const separation = this.main.positionDistanceTo(this.twin);
    const fit = this.estimateLambda();
    this.callbacks.onStats?.({
      time: this.main.time,
      energy: this.main.totalEnergy(),
      energyDrift: this.main.energyDrift(),
      angularMomentum: this.main.angularMomentum(),
      separation,
      lambda: fit ? fit.lambda : null,
      saturated: separation >= this.systemScale * 0.5,
      unstable: this.unstable,
    });
  }

  private emitBodies(): void {
    this.callbacks.onBodies?.(
      this.main.snapshot().map((b, i) => ({
        color: BODY_COLORS[i % BODY_COLORS.length],
        label: b.label,
        mass: b.mass,
      })),
    );
  }

  private refreshChart(): void {
    this.chart.setSeries({
      times: this.times,
      distances: this.distances,
      delta0: this.delta,
      saturation: this.systemScale,
      fit: this.estimateLambda(),
    });
    this.chart.scheduleRender();
  }

  // ------------------------------------------------------------------- camera

  private fitCamera(snap: boolean): void {
    const b = this.main.bounds();
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const spanX = Math.min(Math.max(b.maxX - b.minX, MIN_VIEW_SPAN), MAX_VIEW_SPAN);
    const spanY = Math.min(Math.max(b.maxY - b.minY, MIN_VIEW_SPAN), MAX_VIEW_SPAN);
    const w = this.width || 800;
    const h = this.height || 450;
    const scale = Math.min(w / spanX, h / spanY) * 0.78;

    this.camTarget = { cx, cy, scale };
    if (snap) {
      this.cam = { ...this.camTarget };
      return;
    }
    this.cam = {
      cx: this.cam.cx + (cx - this.cam.cx) * CAMERA_LERP,
      cy: this.cam.cy + (cy - this.cam.cy) * CAMERA_LERP,
      scale: this.cam.scale + (scale - this.cam.scale) * CAMERA_LERP,
    };
  }

  private get viewScale(): number {
    return this.cam.scale * this.zoom;
  }

  private sx(x: number): number {
    return this.width / 2 + (x - this.cam.cx) * this.viewScale;
  }

  private sy(y: number): number {
    return this.height / 2 - (y - this.cam.cy) * this.viewScale;
  }

  // ----------------------------------------------------------------- rendering

  protected draw(): void {
    this.drawBackground();
    const main = this.main.snapshot();
    const twin = this.twin.snapshot();
    const maxMass = Math.max(...main.map((b) => b.mass), 1e-9);

    if (this.showTwin) {
      for (let i = 0; i < this.twinTrails.length; i++) {
        this.drawTrail(this.twinTrails[i], 'rgba(147,161,161,0.30)', 1);
      }
    }
    for (let i = 0; i < this.mainTrails.length; i++) {
      this.drawTrail(this.mainTrails[i], BODY_COLORS[i % BODY_COLORS.length], 1.6);
    }
    if (this.showTwin) {
      twin.forEach((b, i) => this.drawGhostBody(b, i, maxMass));
    }
    main.forEach((b, i) => this.drawBody(b, i, maxMass));

    main.forEach((b, i) => this.drawOffscreenMarker(b, i));
    this.drawScaleBar();
    this.drawHud();
  }

  private drawBackground(): void {
    const { ctx, width, height } = this;
    ctx.fillStyle = '#001a22';
    ctx.fillRect(0, 0, width, height);

    if (this.starW !== width || this.starH !== height) {
      this.regenerateStars();
    }
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(147,161,161,${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.2,
      width / 2, height / 2, Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private regenerateStars(): void {
    this.starW = this.width;
    this.starH = this.height;
    // Deterministic so the sky does not shimmer between frames or resizes.
    let a = 0x9e3779b9;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const count = Math.round((this.width * this.height) / 5200);
    this.stars = Array.from({ length: count }, () => ({
      x: rand(),
      y: rand(),
      r: 0.4 + rand() * 0.9,
      a: 0.08 + rand() * 0.22,
    }));
  }

  /** Four alpha chunks: cheap fade without stroking every segment separately. */
  private drawTrail(trail: Trail | undefined, color: string, lineWidth: number): void {
    if (!trail || trail.size < 2) return;
    const { ctx } = this;
    const chunks = 4;
    const size = trail.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;

    for (let c = 0; c < chunks; c++) {
      const from = Math.floor((size * c) / chunks);
      const to = Math.min(size - 1, Math.floor((size * (c + 1)) / chunks));
      if (to - from < 1) continue;
      ctx.globalAlpha = 0.14 + 0.24 * c;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(this.sx(trail.x(from)), this.sy(trail.y(from)));
      for (let i = from + 1; i <= to; i++) {
        ctx.lineTo(this.sx(trail.x(i)), this.sy(trail.y(i)));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private bodyRadius(mass: number, maxMass: number): number {
    return Math.max(3, Math.min(15, 2.5 + 8 * Math.cbrt(mass / maxMass)));
  }

  private drawBody(b: BodySnapshot, index: number, maxMass: number): void {
    const { ctx } = this;
    const color = BODY_COLORS[index % BODY_COLORS.length];
    const x = this.sx(b.x);
    const y = this.sy(b.y);
    const r = this.bodyRadius(b.mass, maxMass);

    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
    glow.addColorStop(0, `${color}cc`);
    glow.addColorStop(0.35, `${color}55`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(253,246,227,0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawGhostBody(b: BodySnapshot, index: number, maxMass: number): void {
    const { ctx } = this;
    const x = this.sx(b.x);
    const y = this.sy(b.y);
    const r = this.bodyRadius(b.mass, maxMass);
    ctx.strokeStyle = BODY_COLORS[index % BODY_COLORS.length];
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** A body that has been ejected still needs to be findable. */
  private drawOffscreenMarker(b: BodySnapshot, index: number): void {
    const { ctx, width, height } = this;
    const x = this.sx(b.x);
    const y = this.sy(b.y);
    if (x >= 0 && x <= width && y >= 0 && y <= height) return;

    const cx = width / 2;
    const cy = height / 2;
    const angle = Math.atan2(y - cy, x - cx);
    const margin = 14;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const rx = cos < 1e-6 ? Infinity : (cx - margin) / cos;
    const ry = sin < 1e-6 ? Infinity : (cy - margin) / sin;
    const rad = Math.max(0, Math.min(rx, ry));
    const mx = cx + Math.cos(angle) * rad;
    const my = cy + Math.sin(angle) * rad;

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.fillStyle = BODY_COLORS[index % BODY_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawScaleBar(): void {
    const { ctx, height } = this;
    const scale = this.viewScale;
    if (!Number.isFinite(scale) || scale <= 0) return;

    const rawUnits = (this.width * 0.22) / scale;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawUnits)));
    const normalized = rawUnits / magnitude;
    const nice = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
    const px = nice * scale;

    const x0 = 16;
    const y0 = height - 18;
    ctx.strokeStyle = 'rgba(147,161,161,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 4);
    ctx.lineTo(x0, y0 + 4);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + px, y0);
    ctx.moveTo(x0 + px, y0 - 4);
    ctx.lineTo(x0 + px, y0 + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${nice >= 1 ? nice : nice.toFixed(2)} 距離單位`, x0, y0 - 6);
  }

  private drawHud(): void {
    const { ctx } = this;
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(147,161,161,0.9)';
    ctx.fillText(`t = ${this.main.time.toFixed(2)}`, 16, 14);

    if (this.unstable) {
      ctx.fillStyle = '#dc322f';
      ctx.fillText('數值發散 — 請按重置或調大 ε', 16, 32);
    } else if (!this.running) {
      ctx.fillStyle = 'rgba(181,137,0,0.9)';
      ctx.fillText('已暫停', 16, 32);
    }
  }

  public destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.chart.destroy();
    super.destroy();
  }
}
