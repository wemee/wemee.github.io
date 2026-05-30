import { Canvas2DBase, type Canvas2DBaseOptions } from '../Canvas2DBase';

const K = 5;

export interface EntropyState {
  p: number[];
  q: number[];
  H_p: number;
  H_q: number;
  crossEntropy: number; // H(p, q) = -Σ p_i log q_i
  klPQ: number;         // KL(p || q)
  klQP: number;         // KL(q || p)
}

export interface EntropySceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (state: EntropyState) => void;
}

/** Two side-by-side categorical bar charts (p left, q right) with drag-to-edit. */
export class EntropyScene extends Canvas2DBase {
  private p: number[] = [];
  private q: number[] = [];
  private dragging: { dist: 'p' | 'q'; idx: number } | null = null;
  private readonly onUpdate?: (state: EntropyState) => void;

  constructor(options: EntropySceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.applyPreset('uniform-vs-uniform');
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.style.touchAction = 'none';
  }

  public override destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    super.destroy();
  }

  public applyPreset(name: string): void {
    const presets: Record<string, [number[], number[]]> = {
      'uniform-vs-uniform': [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
      'concentrated-vs-uniform': [[0.7, 0.1, 0.1, 0.05, 0.05], [0.2, 0.2, 0.2, 0.2, 0.2]],
      'misaligned': [[0.6, 0.2, 0.1, 0.06, 0.04], [0.05, 0.1, 0.2, 0.25, 0.4]],
      'identical-concentrated': [[0.5, 0.3, 0.1, 0.06, 0.04], [0.5, 0.3, 0.1, 0.06, 0.04]],
    };
    const [pp, qq] = presets[name] ?? presets['uniform-vs-uniform'];
    this.p = this.normalize(pp);
    this.q = this.normalize(qq);
    this.emitUpdate();
    this.scheduleRender();
  }

  private normalize(arr: number[]): number[] {
    const sum = arr.reduce((s, v) => s + v, 0);
    return sum > 0 ? arr.map((v) => v / sum) : new Array(K).fill(1 / K);
  }

  // ─────────────────────────────────────────── geometry

  private layout() {
    const padL = 36;
    const padR = 24;
    const padT = 12;
    const padB = 36;
    const midGap = 30;
    const totalW = this.width - padL - padR - midGap;
    const halfW = totalW / 2;
    return {
      padT, padB,
      leftRect: { x: padL, y: padT, w: halfW, h: this.height - padT - padB },
      rightRect: { x: padL + halfW + midGap, y: padT, w: halfW, h: this.height - padT - padB },
    };
  }

  private hitTest(px: number, py: number): { dist: 'p' | 'q'; idx: number } | null {
    const { leftRect, rightRect } = this.layout();
    const rects: { dist: 'p' | 'q'; r: { x: number; y: number; w: number; h: number } }[] = [
      { dist: 'p', r: leftRect }, { dist: 'q', r: rightRect },
    ];
    for (const { dist, r } of rects) {
      if (px < r.x || px > r.x + r.w) continue;
      const binW = r.w / K;
      const i = Math.min(K - 1, Math.max(0, Math.floor((px - r.x) / binW)));
      if (py >= r.y && py <= r.y + r.h) return { dist, idx: i };
    }
    return null;
  }

  private pointerCoords(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.pointerCoords(e);
    const hit = this.hitTest(x, y);
    if (hit) {
      this.dragging = hit;
      this.canvas.setPointerCapture(e.pointerId);
      this.applyDrag(x, y);
      e.preventDefault();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const { x, y } = this.pointerCoords(e);
    this.applyDrag(x, y);
    e.preventDefault();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragging) {
      this.canvas.releasePointerCapture(e.pointerId);
      this.dragging = null;
    }
  };

  private applyDrag(px: number, py: number): void {
    if (!this.dragging) return;
    const { leftRect, rightRect } = this.layout();
    const r = this.dragging.dist === 'p' ? leftRect : rightRect;
    const yMax = 0.85; // bars top out at 85% so drag has headroom
    const t = Math.max(0.01, Math.min(yMax, (r.y + r.h - py) / r.h));
    this.setBin(this.dragging.dist, this.dragging.idx, t);
  }

  private setBin(dist: 'p' | 'q', idx: number, target: number): void {
    const arr = dist === 'p' ? [...this.p] : [...this.q];
    target = Math.max(0.005, Math.min(0.95, target));
    const restSum = arr.reduce((s, v, i) => (i === idx ? s : s + v), 0);
    if (restSum < 1e-9) {
      arr[idx] = target;
      const rest = (1 - target) / (K - 1);
      for (let i = 0; i < K; i++) if (i !== idx) arr[i] = rest;
    } else {
      arr[idx] = target;
      const scale = (1 - target) / restSum;
      for (let i = 0; i < K; i++) if (i !== idx) arr[i] *= scale;
    }
    if (dist === 'p') this.p = arr;
    else this.q = arr;
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── stats

  private compute(): EntropyState {
    const log2 = (x: number) => Math.log(x) / Math.LN2;
    let Hp = 0, Hq = 0, ce = 0, klPQ = 0, klQP = 0;
    for (let i = 0; i < K; i++) {
      const pi = this.p[i];
      const qi = this.q[i];
      if (pi > 0) Hp -= pi * log2(pi);
      if (qi > 0) Hq -= qi * log2(qi);
      if (pi > 0 && qi > 0) {
        ce -= pi * log2(qi);
        klPQ += pi * (log2(pi) - log2(qi));
      }
      if (qi > 0 && pi > 0) klQP += qi * (log2(qi) - log2(pi));
    }
    return {
      p: [...this.p],
      q: [...this.q],
      H_p: Hp,
      H_q: Hq,
      crossEntropy: ce,
      klPQ,
      klQP,
    };
  }

  private emitUpdate(): void {
    this.onUpdate?.(this.compute());
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    const { leftRect, rightRect } = this.layout();

    this.drawBarChart(leftRect, this.p, 'p', 'rgba(38,139,210,0.85)');
    this.drawBarChart(rightRect, this.q, 'q', 'rgba(220,50,47,0.85)');

    // Drag hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('點擊柱子並拖動 — 其他長條會自動歸一化', this.width / 2, this.height - 4);
  }

  private drawBarChart(
    r: { x: number; y: number; w: number; h: number },
    probs: number[],
    label: string,
    color: string,
  ): void {
    const ctx = this.ctx;
    const yMax = 0.85;

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = (yMax / 4) * i;
      const y = r.y + r.h - (v / yMax) * r.h;
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
      ctx.fillText(v.toFixed(2), r.x - 4, y);
    }

    // Bars
    const binW = r.w / K;
    const barW = binW * 0.78;
    const barOff = (binW - barW) / 2;
    for (let i = 0; i < K; i++) {
      const x0 = r.x + i * binW + barOff;
      const p = probs[i];
      const h = (p / yMax) * r.h;
      const y = r.y + r.h - h;
      const grad = ctx.createLinearGradient(0, y, 0, r.y + r.h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color.replace('0.85', '0.45'));
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y, barW, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y, barW, h);

      // Bin label
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), r.x + i * binW + binW / 2, r.y + r.h + 4);

      // Value above bar (if room)
      if (h > 18) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.toFixed(2), r.x + i * binW + binW / 2, y - 2);
      }
    }

    // Top-left label
    ctx.fillStyle = color;
    ctx.font = 'bold 14px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(label, r.x + 4, r.y + 4);
  }
}
