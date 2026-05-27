import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';
import { randNormal } from './mathHelpers';

export type TargetKind = 'gaussian' | 'bimodal' | 'banana' | 'donut';

interface TargetInfo {
  label: string;
  /** Energy = -log p (up to constant). Higher = less probable. */
  energy: (x: number, y: number) => number;
  /** Display range. */
  xRange: [number, number];
  yRange: [number, number];
  /** Sensible starting point. */
  init: [number, number];
}

const TARGETS: Record<TargetKind, TargetInfo> = {
  gaussian: {
    label: '單峰常態',
    energy: (x, y) => (x * x + y * y) / 2,
    xRange: [-3.5, 3.5], yRange: [-3.5, 3.5],
    init: [3, 3],
  },
  bimodal: {
    label: '雙峰',
    energy: (x, y) => {
      const d1 = ((x + 1.5) ** 2 + y * y) / (2 * 0.5 ** 2);
      const d2 = ((x - 1.5) ** 2 + y * y) / (2 * 0.5 ** 2);
      // -log of (0.5 * e^-d1 + 0.5 * e^-d2). Use logsumexp.
      const m = Math.min(d1, d2);
      return m - Math.log(0.5 * Math.exp(-(d1 - m)) + 0.5 * Math.exp(-(d2 - m)));
    },
    xRange: [-4, 4], yRange: [-3, 3],
    init: [0, 2],
  },
  banana: {
    label: '香蕉形 (Rosenbrock)',
    energy: (x, y) => (x * x) / 4 + ((y - x * x / 2) ** 2) / 0.5,
    xRange: [-4, 4], yRange: [-2, 5.5],
    init: [-3, -1],
  },
  donut: {
    label: '甜甜圈',
    energy: (x, y) => ((Math.hypot(x, y) - 2) ** 2) / (2 * 0.25 ** 2),
    xRange: [-3.5, 3.5], yRange: [-3.5, 3.5],
    init: [0, 0],
  },
};

export interface MarkovState {
  target: TargetKind;
  proposalSigma: number;
  speedStepsPerFrame: number;
  isRunning: boolean;
  totalSteps: number;
  acceptedSteps: number;
  acceptRate: number;
  current: [number, number];
}

export interface MarkovSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (state: MarkovState) => void;
}

export class MarkovScene extends Canvas2DBase {
  private target: TargetKind = 'bimodal';
  private proposalSigma = 0.5;
  private speedStepsPerFrame = 4;
  private isRunning = false;
  private rafId: number | null = null;

  private cur: [number, number] = [0, 0];
  private curEnergy = 0;
  private totalSteps = 0;
  private acceptedSteps = 0;

  /** All accepted samples, capped. */
  private samples: [number, number][] = [];
  private static readonly MAX_SAMPLES = 8000;
  /** Recent trajectory (the actual chain, including stayed-put), for drawing the line. */
  private trajectory: [number, number][] = [];
  private static readonly MAX_TRAJ = 200;

  // Cached heatmap (regenerated on resize / target change)
  private heatmapData: ImageData | null = null;
  private heatmapW = 0;
  private heatmapH = 0;
  private heatmapDirty = true;

  private readonly onUpdate?: (state: MarkovState) => void;

  constructor(options: MarkovSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.reset();
  }

  // ─────────────────────────────────────────── public

  public setTarget(target: TargetKind): void {
    if (target === this.target) return;
    this.target = target;
    this.heatmapDirty = true;
    this.reset();
  }

  public setProposalSigma(s: number): void {
    this.proposalSigma = Math.max(0.05, Math.min(3, s));
    this.emitUpdate();
  }

  public setSpeed(steps: number): void {
    this.speedStepsPerFrame = Math.max(1, Math.min(50, Math.round(steps)));
    this.emitUpdate();
  }

  public toggleRun(): void {
    if (this.isRunning) this.stop();
    else this.start();
  }

  public step(n = 1): void {
    for (let i = 0; i < n; i++) this.metropolisStep();
    this.emitUpdate();
    this.scheduleRender();
  }

  public reset(): void {
    this.stop();
    const info = TARGETS[this.target];
    this.cur = [...info.init] as [number, number];
    this.curEnergy = info.energy(this.cur[0], this.cur[1]);
    this.totalSteps = 0;
    this.acceptedSteps = 0;
    this.samples = [];
    this.trajectory = [[...this.cur] as [number, number]];
    this.emitUpdate();
    this.scheduleRender();
  }

  public override destroy(): void {
    this.stop();
    super.destroy();
  }

  protected override setupCanvas(): void {
    super.setupCanvas();
    this.heatmapDirty = true;
  }

  // ─────────────────────────────────────────── M-H

  private metropolisStep(): void {
    const info = TARGETS[this.target];
    const px = this.cur[0] + randNormal(0, this.proposalSigma);
    const py = this.cur[1] + randNormal(0, this.proposalSigma);
    const proposedEnergy = info.energy(px, py);
    const logA = this.curEnergy - proposedEnergy;
    const accepted = logA >= 0 || Math.random() < Math.exp(logA);
    this.totalSteps++;
    if (accepted) {
      this.cur = [px, py];
      this.curEnergy = proposedEnergy;
      this.acceptedSteps++;
    }
    // Push a sample regardless of accept (so the chain represents the distribution)
    if (this.samples.length < MarkovScene.MAX_SAMPLES) {
      this.samples.push([this.cur[0], this.cur[1]]);
    } else {
      // Replace random old sample (thinning)
      const idx = Math.floor(Math.random() * MarkovScene.MAX_SAMPLES);
      this.samples[idx] = [this.cur[0], this.cur[1]];
    }
    this.trajectory.push([this.cur[0], this.cur[1]]);
    if (this.trajectory.length > MarkovScene.MAX_TRAJ) this.trajectory.shift();
  }

  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emitUpdate();
    const tick = () => {
      if (!this.isRunning) return;
      for (let i = 0; i < this.speedStepsPerFrame; i++) this.metropolisStep();
      this.emitUpdate();
      this.scheduleRender();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.onUpdate?.({
      target: this.target,
      proposalSigma: this.proposalSigma,
      speedStepsPerFrame: this.speedStepsPerFrame,
      isRunning: this.isRunning,
      totalSteps: this.totalSteps,
      acceptedSteps: this.acceptedSteps,
      acceptRate: this.totalSteps > 0 ? this.acceptedSteps / this.totalSteps : NaN,
      current: [this.cur[0], this.cur[1]],
    });
  }

  // ─────────────────────────────────────────── drawing

  private rebuildHeatmap(): void {
    const info = TARGETS[this.target];
    const W = Math.max(1, Math.floor(this.width));
    const H = Math.max(1, Math.floor(this.height));
    this.heatmapW = W;
    this.heatmapH = H;
    const img = this.ctx.createImageData(W, H);
    // Find max p to normalize
    // Sample over the displayed range, take min energy.
    let minE = Infinity;
    const probeN = 60;
    for (let j = 0; j < probeN; j++) {
      const yf = info.yRange[0] + ((info.yRange[1] - info.yRange[0]) * j) / (probeN - 1);
      for (let i = 0; i < probeN; i++) {
        const xf = info.xRange[0] + ((info.xRange[1] - info.xRange[0]) * i) / (probeN - 1);
        const e = info.energy(xf, yf);
        if (e < minE) minE = e;
      }
    }
    // Fill pixels
    let k = 0;
    for (let py = 0; py < H; py++) {
      const yf = info.yRange[0] + ((info.yRange[1] - info.yRange[0]) * (H - 1 - py)) / (H - 1);
      for (let px = 0; px < W; px++) {
        const xf = info.xRange[0] + ((info.xRange[1] - info.xRange[0]) * px) / (W - 1);
        const e = info.energy(xf, yf);
        // p ∝ exp(-(e - minE)); 0 → 1 mapping with gamma for visibility
        const t = Math.exp(-(e - minE));
        const tt = Math.pow(t, 0.5);
        // Dark teal background → warm peak (orange)
        const r = Math.round(15 + 240 * tt);
        const g = Math.round(20 + 130 * tt);
        const b = Math.round(40 + 50 * tt);
        img.data[k++] = r;
        img.data[k++] = g;
        img.data[k++] = b;
        img.data[k++] = 255;
      }
    }
    this.heatmapData = img;
    this.heatmapDirty = false;
  }

  protected draw(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const info = TARGETS[this.target];

    if (this.heatmapDirty || this.heatmapW !== Math.floor(W) || this.heatmapH !== Math.floor(H)) {
      this.rebuildHeatmap();
    }
    if (this.heatmapData) ctx.putImageData(this.heatmapData, 0, 0);

    const toX = (x: number) => ((x - info.xRange[0]) / (info.xRange[1] - info.xRange[0])) * W;
    const toY = (y: number) => H - ((y - info.yRange[0]) / (info.yRange[1] - info.yRange[0])) * H;

    // Accumulated samples
    if (this.samples.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < this.samples.length; i++) {
        const [sx, sy] = this.samples[i];
        const xp = toX(sx);
        const yp = toY(sy);
        ctx.fillRect(xp - 1, yp - 1, 2, 2);
      }
    }

    // Recent trajectory
    if (this.trajectory.length > 1) {
      ctx.strokeStyle = 'rgba(133,153,0,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < this.trajectory.length; i++) {
        const [sx, sy] = this.trajectory[i];
        const xp = toX(sx);
        const yp = toY(sy);
        if (i === 0) ctx.moveTo(xp, yp);
        else ctx.lineTo(xp, yp);
      }
      ctx.stroke();
    }

    // Current position
    const [cx, cy] = this.cur;
    const cxp = toX(cx);
    const cyp = toY(cy);
    ctx.fillStyle = 'rgba(220,50,47,1)';
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cxp, cyp, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
