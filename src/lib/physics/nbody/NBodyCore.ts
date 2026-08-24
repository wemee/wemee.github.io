/**
 * NBodyCore — pure gravitational N-body dynamics. No DOM, no Canvas.
 *
 * Two things here are deliberate and load-bearing for the whole page:
 *
 * 1. **Velocity Verlet (kick-drift-kick), not Euler.** Verlet is symplectic:
 *    total energy oscillates around a constant instead of drifting. With
 *    forward Euler a circular two-body orbit visibly spirals outward within
 *    seconds, which would destroy the entire point of the page ("two bodies
 *    are stable"). The energy-drift readout on the page is the receipt.
 *
 * 2. **Plummer softening ε.** The Newtonian 1/r² force diverges at r → 0, so
 *    a close three-body encounter integrated at fixed dt blows up. We solve
 *    (r² + ε²) instead, and — importantly — use the *same* ε in the potential
 *    energy, so the softened system has an exact conserved Hamiltonian and the
 *    drift meter stays honest.
 *
 * State lives in flat Float64Arrays and is mutated in place. This is the one
 * deliberate exception to the project's immutability rule: `step()` runs
 * thousands of times per second and per-step allocation would dominate the
 * cost. Nothing mutable escapes — `snapshot()` hands out fresh frozen-shape
 * objects and is called ~60×/s, not 2000×/s.
 */

/** Gravitational constant. The whole page works in G = 1 units. */
export const G = 1;

export interface BodyInit {
  readonly mass: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly label?: string;
}

export interface BodySnapshot {
  readonly mass: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly label: string;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface NBodyCoreOptions {
  /** Plummer softening length ε, in the same length unit as positions. */
  softening?: number;
}

const DEFAULT_SOFTENING = 0.02;

export class NBodyCore {
  private count = 0;
  private m = new Float64Array(0);
  private px = new Float64Array(0);
  private py = new Float64Array(0);
  private vx = new Float64Array(0);
  private vy = new Float64Array(0);
  private ax = new Float64Array(0);
  private ay = new Float64Array(0);
  private labels: string[] = [];

  private simTime = 0;
  private initialEnergy = 0;
  private softening: number;

  constructor(bodies: readonly BodyInit[], options: NBodyCoreOptions = {}) {
    this.softening = Math.max(1e-6, options.softening ?? DEFAULT_SOFTENING);
    this.reset(bodies);
  }

  /**
   * Load a fresh set of bodies. Drops the barycentre drift (see removeDrift)
   * and re-baselines the energy meter.
   */
  public reset(bodies: readonly BodyInit[]): void {
    const n = bodies.length;
    this.count = n;
    this.m = new Float64Array(n);
    this.px = new Float64Array(n);
    this.py = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.ax = new Float64Array(n);
    this.ay = new Float64Array(n);
    this.labels = bodies.map((b, i) => b.label ?? `M${i + 1}`);

    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      this.m[i] = b.mass;
      this.px[i] = b.x;
      this.py[i] = b.y;
      this.vx[i] = b.vx;
      this.vy[i] = b.vy;
    }

    this.removeDrift();
    this.computeAccelerations();
    this.simTime = 0;
    this.initialEnergy = this.totalEnergy();
  }

  /**
   * Move to the barycentric frame: put the centre of mass at the origin and
   * zero its velocity. Without this, a preset with net momentum slowly sails
   * off-screen and the "chaos" you think you're watching is partly just pan.
   */
  private removeDrift(): void {
    const n = this.count;
    let totalMass = 0;
    let cx = 0;
    let cy = 0;
    let momX = 0;
    let momY = 0;

    for (let i = 0; i < n; i++) {
      totalMass += this.m[i];
      cx += this.m[i] * this.px[i];
      cy += this.m[i] * this.py[i];
      momX += this.m[i] * this.vx[i];
      momY += this.m[i] * this.vy[i];
    }
    if (totalMass <= 0) return;

    cx /= totalMass;
    cy /= totalMass;
    const dvx = momX / totalMass;
    const dvy = momY / totalMass;

    for (let i = 0; i < n; i++) {
      this.px[i] -= cx;
      this.py[i] -= cy;
      this.vx[i] -= dvx;
      this.vy[i] -= dvy;
    }
  }

  private computeAccelerations(): void {
    const n = this.count;
    const eps2 = this.softening * this.softening;
    this.ax.fill(0);
    this.ay.fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = this.px[j] - this.px[i];
        const dy = this.py[j] - this.py[i];
        const r2 = dx * dx + dy * dy + eps2;
        const invR3 = 1 / (r2 * Math.sqrt(r2));
        const s = G * invR3;
        this.ax[i] += s * this.m[j] * dx;
        this.ay[i] += s * this.m[j] * dy;
        this.ax[j] -= s * this.m[i] * dx;
        this.ay[j] -= s * this.m[i] * dy;
      }
    }
  }

  /** One velocity-Verlet step of fixed size dt (kick — drift — kick). */
  public step(dt: number): void {
    const n = this.count;
    const half = dt * 0.5;

    for (let i = 0; i < n; i++) {
      this.vx[i] += this.ax[i] * half;
      this.vy[i] += this.ay[i] * half;
    }
    for (let i = 0; i < n; i++) {
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
    }

    this.computeAccelerations();

    for (let i = 0; i < n; i++) {
      this.vx[i] += this.ax[i] * half;
      this.vy[i] += this.ay[i] * half;
    }

    this.simTime += dt;
  }

  public kineticEnergy(): number {
    let k = 0;
    for (let i = 0; i < this.count; i++) {
      k += 0.5 * this.m[i] * (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    }
    return k;
  }

  /** Softened potential — matches the softened force exactly. */
  public potentialEnergy(): number {
    const eps2 = this.softening * this.softening;
    let u = 0;
    for (let i = 0; i < this.count; i++) {
      for (let j = i + 1; j < this.count; j++) {
        const dx = this.px[j] - this.px[i];
        const dy = this.py[j] - this.py[i];
        u -= (G * this.m[i] * this.m[j]) / Math.sqrt(dx * dx + dy * dy + eps2);
      }
    }
    return u;
  }

  public totalEnergy(): number {
    return this.kineticEnergy() + this.potentialEnergy();
  }

  /** Scalar z-component of angular momentum (the only one in 2D). */
  public angularMomentum(): number {
    let l = 0;
    for (let i = 0; i < this.count; i++) {
      l += this.m[i] * (this.px[i] * this.vy[i] - this.py[i] * this.vx[i]);
    }
    return l;
  }

  /** |E − E₀| / |E₀| — the honesty meter for the integrator. */
  public energyDrift(): number {
    const e0 = this.initialEnergy;
    if (!Number.isFinite(e0) || Math.abs(e0) < 1e-12) return 0;
    return Math.abs((this.totalEnergy() - e0) / e0);
  }

  /**
   * RMS position distance to another core holding the same body count.
   * This is the twin-run divergence metric d(t).
   */
  public positionDistanceTo(other: NBodyCore): number {
    const n = Math.min(this.count, other.count);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const dx = this.px[i] - other.px[i];
      const dy = this.py[i] - other.py[i];
      sum += dx * dx + dy * dy;
    }
    return Math.sqrt(sum);
  }

  public bounds(): Bounds {
    if (this.count === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.px[i] < minX) minX = this.px[i];
      if (this.px[i] > maxX) maxX = this.px[i];
      if (this.py[i] < minY) minY = this.py[i];
      if (this.py[i] > maxY) maxY = this.py[i];
    }
    return { minX, maxX, minY, maxY };
  }

  /** Guard against a run that has gone numerically non-finite. */
  public isFinite(): boolean {
    for (let i = 0; i < this.count; i++) {
      if (!Number.isFinite(this.px[i]) || !Number.isFinite(this.py[i])) return false;
      if (!Number.isFinite(this.vx[i]) || !Number.isFinite(this.vy[i])) return false;
    }
    return true;
  }

  public snapshot(): BodySnapshot[] {
    const out: BodySnapshot[] = [];
    for (let i = 0; i < this.count; i++) {
      out.push({
        mass: this.m[i],
        x: this.px[i],
        y: this.py[i],
        vx: this.vx[i],
        vy: this.vy[i],
        label: this.labels[i],
      });
    }
    return out;
  }

  public get bodyCount(): number {
    return this.count;
  }

  public get time(): number {
    return this.simTime;
  }

  public get epsilon(): number {
    return this.softening;
  }
}
