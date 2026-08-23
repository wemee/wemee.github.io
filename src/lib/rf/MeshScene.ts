/**
 * MeshScene — the animated view over MeshSim, plus the head-to-head bar chart.
 *
 * All the logic lives in MeshSim so the same code can run headless: the
 * comparison chart runs each strategy over dozens of identical node layouts
 * and averages, which is the only fair way to compare them — a single run is
 * dominated by whether the source happened to land near a well-connected node.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import {
  MeshSim,
  compareModes,
  FIELD,
  MESH_MODES,
  type MeshConfig,
  type MeshMode,
  type MeshStats,
  type ModeComparison,
} from './MeshSim';

/** Sim-milliseconds advanced per real second at 1×. */
const BASE_RATE = 1000;

export interface MeshSceneOptions extends Canvas2DBaseOptions {
  chartCanvasId: string;
  onStats?: (s: MeshStats) => void;
  onComparison?: (c: ModeComparison[] | null) => void;
}

export class MeshScene extends Canvas2DBase {
  private config: Omit<MeshConfig, 'mode'> = {
    nodeCount: 30,
    range: 26,
    hopLimit: 3,
    airtimeMs: 354,
    contentionWindowMs: 700,
  };
  private mode: MeshMode = 'meshtastic';
  private seed = 4242;
  private speed = 1;
  private showLinks = true;

  private sim: MeshSim;
  private chart: ComparisonChart;
  private running = true;
  private rafId: number | null = null;
  private lastFrame = 0;

  private readonly onStats?: (s: MeshStats) => void;
  private readonly onComparison?: (c: ModeComparison[] | null) => void;

  constructor(options: MeshSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.onComparison = options.onComparison;
    this.chart = new ComparisonChart({ canvasId: options.chartCanvasId });
    this.sim = new MeshSim({ ...this.config, mode: this.mode }, this.seed);
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
    this.emit();
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.chart.destroy();
    super.destroy();
  }

  // ─────────────────────────────────────────── controls

  private restart(): void {
    this.sim = new MeshSim({ ...this.config, mode: this.mode }, this.seed);
    this.lastFrame = 0;
    this.emit();
    this.scheduleRender();
  }

  public setMode(mode: MeshMode): void { this.mode = mode; this.restart(); }
  public setNodeCount(n: number): void { this.config = { ...this.config, nodeCount: Math.round(n) }; this.restart(); }
  public setRange(r: number): void { this.config = { ...this.config, range: r }; this.restart(); }
  public setHopLimit(h: number): void { this.config = { ...this.config, hopLimit: Math.round(h) }; this.restart(); }
  public setAirtime(ms: number): void { this.config = { ...this.config, airtimeMs: ms }; this.restart(); }
  public setContentionWindow(ms: number): void { this.config = { ...this.config, contentionWindowMs: ms }; this.restart(); }
  public setSpeed(v: number): void { this.speed = v; }
  public setShowLinks(on: boolean): void { this.showLinks = on; this.scheduleRender(); }
  public replay(): void { this.restart(); }
  public reseed(): void { this.seed = (this.seed * 1103515245 + 12345) >>> 0; this.restart(); }
  public get currentMode(): MeshMode { return this.mode; }

  /** Run every strategy over the same layouts and chart the averages. */
  public runComparison(runs = 40): void {
    const result = compareModes(this.config, runs, this.seed);
    this.chart.setData(result, runs);
    this.onComparison?.(result);
  }

  public clearComparison(): void {
    this.chart.setData(null, 0);
    this.onComparison?.(null);
  }

  private emit(): void {
    this.onStats?.(this.sim.stats());
  }

  private loop(now: number): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.lastFrame === 0) this.lastFrame = now;
    const dtReal = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.running || this.sim.isFinished) return;
    const target = dtReal * BASE_RATE * this.speed;
    let done = 0;
    while (done < target && !this.sim.isFinished) {
      this.sim.step(5);
      done += 5;
    }
    this.scheduleRender();
    this.emit();
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);

    const pad = 16;
    const size = Math.min(this.width - pad * 2, this.height - pad * 2);
    if (size < 40) return;
    const ox = (this.width - size) / 2;
    const oy = (this.height - size) / 2;
    const toPx = (v: number) => (v / FIELD) * size;
    const px = (x: number) => ox + toPx(x);
    const py = (y: number) => oy + toPx(y);

    ctx.strokeStyle = 'rgba(88,110,117,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, size, size);

    const view = this.sim.view();
    const neighbours = this.sim.neighbourList;

    if (this.showLinks) {
      ctx.strokeStyle = 'rgba(88,110,117,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < view.length; i++) {
        for (const j of neighbours[i]) {
          if (j < i) continue;
          ctx.moveTo(px(view[i].x), py(view[i].y));
          ctx.lineTo(px(view[j].x), py(view[j].y));
        }
      }
      ctx.stroke();
    }

    // transmitting nodes paint their whole coverage disc — that area is the
    // channel they are occupying for the full airtime
    for (const n of view) {
      if (!n.transmitting) continue;
      ctx.fillStyle = 'rgba(181,137,0,0.13)';
      ctx.beginPath();
      ctx.arc(px(n.x), py(n.y), toPx(this.config.range), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(181,137,0,0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    for (let i = 0; i < view.length; i++) {
      const n = view[i];
      const x = px(n.x);
      const y = py(n.y);
      const r = i === 0 ? 8 : 6;

      if (n.pending) {
        ctx.strokeStyle = 'rgba(181,137,0,0.85)';
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = n.transmitting
        ? '#b58900'
        : n.reached
          ? '#859900'
          : 'rgba(88,110,117,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (i === 0) {
        ctx.strokeStyle = '#fdf6e3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (n.collisions > 0) {
        ctx.fillStyle = '#dc322f';
        ctx.beginPath();
        ctx.arc(x + r * 0.8, y - r * 0.8, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (n.txCount > 1) {
        ctx.fillStyle = 'rgba(253,246,227,0.9)';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n.txCount), x, y);
      }
    }

    const st = this.sim.stats();
    ctx.fillStyle = 'rgba(4,34,43,0.8)';
    ctx.fillRect(ox + 6, oy + 6, 178, 54);
    ctx.fillStyle = '#93a1a1';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`t = ${(st.timeMs / 1000).toFixed(2)} s`, ox + 12, oy + 12);
    ctx.fillText(`送達 ${st.reached}/${st.nodes} · 轉送 ${st.transmissions}`, ox + 12, oy + 28);
    ctx.fillStyle = st.finished ? '#859900' : '#b58900';
    ctx.fillText(st.finished ? '✓ 傳播結束' : '● 傳播中…', ox + 12, oy + 44);

    ctx.fillStyle = 'rgba(147,161,161,0.6)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('白圈 = 訊息來源　黃 = 正在佔用頻道　綠 = 已收到　紅點 = 曾發生碰撞', ox + size - 4, oy + size - 4);
  }
}

/** Averaged head-to-head bars for the four strategies. */
class ComparisonChart extends Canvas2DBase {
  private data: ModeComparison[] | null = null;
  private runs = 0;

  constructor(options: Canvas2DBaseOptions) {
    super(options);
    this.scheduleRender();
  }

  public setData(data: ModeComparison[] | null, runs: number): void {
    this.data = data;
    this.runs = runs;
    this.scheduleRender();
  }

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.data) {
      ctx.fillStyle = 'rgba(147,161,161,0.55)';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('按「四種策略各跑 40 次比較」開始', this.width / 2, this.height / 2);
      return;
    }

    const groups: { label: string; get: (c: ModeComparison) => number; fmt: (v: number) => string; color: string }[] = [
      { label: '送達率', get: (c) => c.deliveryRatio, fmt: (v) => `${(v * 100).toFixed(0)}%`, color: '#859900' },
      { label: '轉送次數', get: (c) => c.transmissions, fmt: (v) => v.toFixed(1), color: '#268bd2' },
      { label: '碰撞次數', get: (c) => c.collisions, fmt: (v) => v.toFixed(1), color: '#dc322f' },
      { label: '總空中時間', get: (c) => c.airtimeMs / 1000, fmt: (v) => `${v.toFixed(1)}s`, color: '#b58900' },
    ];

    const padL = 14;
    const padT = 24;
    const padB = 30;
    const gap = 14;
    const groupW = (this.width - padL * 2 - gap * (groups.length - 1)) / groups.length;
    const ph = this.height - padT - padB;

    ctx.font = '10px ui-monospace, monospace';
    for (let g = 0; g < groups.length; g++) {
      const grp = groups[g];
      const gx = padL + g * (groupW + gap);
      const max = Math.max(...this.data.map(grp.get)) || 1;
      const barW = (groupW / this.data.length) * 0.72;

      ctx.fillStyle = 'rgba(147,161,161,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(grp.label, gx + groupW / 2, 4);

      for (let i = 0; i < this.data.length; i++) {
        const v = grp.get(this.data[i]);
        const h = (v / max) * (ph - 16);
        const x = gx + (groupW / this.data.length) * (i + 0.5) - barW / 2;
        const y = padT + ph - h;
        ctx.fillStyle = grp.color;
        ctx.globalAlpha = this.data[i].mode === 'meshtastic' ? 1 : 0.45;
        ctx.fillRect(x, y, barW, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(253,246,227,0.9)';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(grp.fmt(v), x + barW / 2, y - 2);
      }

      ctx.strokeStyle = 'rgba(88,110,117,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, padT + ph);
      ctx.lineTo(gx + groupW, padT + ph);
      ctx.stroke();
    }

    // legend along the bottom, ordered exactly like the bars
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let lx = padL;
    for (let i = 0; i < MESH_MODES.length; i++) {
      const label = `${i + 1}. ${MESH_MODES[i].label}`;
      ctx.fillStyle = MESH_MODES[i].id === 'meshtastic' ? '#fdf6e3' : 'rgba(147,161,161,0.7)';
      ctx.fillText(label, lx, this.height - padB + 16);
      lx += ctx.measureText(label).width + 14;
    }
    ctx.fillStyle = 'rgba(147,161,161,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText(`每種策略在同樣的 ${this.runs} 組佈點上各跑一次取平均`, this.width - padL, this.height - padB + 16);
  }
}
