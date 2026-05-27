import { Canvas2DBase, type Canvas2DBaseOptions } from './Canvas2DBase';

export type DiceMode = '1d6' | '2d6';

export interface DiceState {
  mode: DiceMode;
  totalRolls: number;
  counts: number[];
  showTheoretical: boolean;
  isAutoRolling: boolean;
  lastRoll: number | null;
}

export interface DiceSceneOptions extends Canvas2DBaseOptions {
  onUpdate?: (state: DiceState) => void;
}

/**
 * Dice simulator for the /math/probstat/ index hero.
 *
 * 1d6  → outcomes 1..6, theoretical PMF = uniform 1/6 each.
 * 2d6  → outcomes 2..12, theoretical PMF = triangular (1,2,3,4,5,6,5,4,3,2,1)/36.
 *
 * Toggle "持續擲" runs ~10 rolls/frame so 10 000 rolls accumulates in ~16 s,
 * enough to watch the empirical bars converge onto the theoretical overlay.
 * This is the "嗨身" for the LLN/CLT chapter.
 */
export class DiceScene extends Canvas2DBase {
  private mode: DiceMode = '1d6';
  private counts: number[] = new Array(6).fill(0);
  private totalRolls = 0;
  private showTheoretical = true;
  private isAutoRolling = false;
  private lastRoll: number | null = null;
  private autoRafId: number | null = null;

  private readonly onUpdate?: (state: DiceState) => void;

  // Rolls per frame in auto mode. Tuned so that 10k rolls takes ~16s @ 60fps.
  private static readonly AUTO_ROLLS_PER_FRAME = 10;

  constructor(options: DiceSceneOptions) {
    super(options);
    this.onUpdate = options.onUpdate;
    this.emitUpdate();
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── public API

  public setMode(mode: DiceMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.counts = new Array(mode === '1d6' ? 6 : 11).fill(0);
    this.totalRolls = 0;
    this.lastRoll = null;
    this.stopAuto();
    this.emitUpdate();
    this.scheduleRender();
  }

  public roll(n: number): void {
    if (n <= 0) return;
    for (let i = 0; i < n; i++) this.rollOnce();
    this.emitUpdate();
    this.scheduleRender();
  }

  public toggleAuto(): void {
    if (this.isAutoRolling) this.stopAuto();
    else this.startAuto();
  }

  public reset(): void {
    this.counts.fill(0);
    this.totalRolls = 0;
    this.lastRoll = null;
    this.stopAuto();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setShowTheoretical(show: boolean): void {
    this.showTheoretical = show;
    this.emitUpdate();
    this.scheduleRender();
  }

  public override destroy(): void {
    this.stopAuto();
    super.destroy();
  }

  // ─────────────────────────────────────────── internals

  private rollOnce(): number {
    const r1 = Math.floor(Math.random() * 6) + 1;
    if (this.mode === '1d6') {
      this.counts[r1 - 1]++;
      this.lastRoll = r1;
      this.totalRolls++;
      return r1;
    }
    const r2 = Math.floor(Math.random() * 6) + 1;
    const sum = r1 + r2;
    this.counts[sum - 2]++;
    this.lastRoll = sum;
    this.totalRolls++;
    return sum;
  }

  private startAuto(): void {
    if (this.isAutoRolling) return;
    this.isAutoRolling = true;
    this.emitUpdate();
    const tick = () => {
      if (!this.isAutoRolling) return;
      for (let i = 0; i < DiceScene.AUTO_ROLLS_PER_FRAME; i++) this.rollOnce();
      this.emitUpdate();
      this.scheduleRender();
      this.autoRafId = requestAnimationFrame(tick);
    };
    this.autoRafId = requestAnimationFrame(tick);
  }

  private stopAuto(): void {
    if (!this.isAutoRolling) return;
    this.isAutoRolling = false;
    if (this.autoRafId !== null) {
      cancelAnimationFrame(this.autoRafId);
      this.autoRafId = null;
    }
    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.onUpdate?.({
      mode: this.mode,
      totalRolls: this.totalRolls,
      counts: this.counts.slice(),
      showTheoretical: this.showTheoretical,
      isAutoRolling: this.isAutoRolling,
      lastRoll: this.lastRoll,
    });
  }

  private theoreticalPMF(): number[] {
    if (this.mode === '1d6') return new Array(6).fill(1 / 6);
    // 2d6: count ways to make each sum then divide by 36
    const ways = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
    return ways.map((w) => w / 36);
  }

  private outcomeLabels(): number[] {
    if (this.mode === '1d6') return [1, 2, 3, 4, 5, 6];
    return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const padL = 48;
    const padR = 24;
    const padT = 18;
    const padB = 36;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    if (plotW <= 0 || plotH <= 0) return;

    const labels = this.outcomeLabels();
    const n = labels.length;
    const theo = this.theoreticalPMF();

    const empirical = this.totalRolls === 0
      ? new Array(n).fill(0)
      : this.counts.map((c) => c / this.totalRolls);

    // Y-axis max: 0 to max(empirical, theoretical) * 1.2, floor at 0.05 so empty
    // state still has reasonable scale.
    const maxObserved = Math.max(...empirical, ...theo);
    const yMax = Math.max(0.05, maxObserved * 1.2);

    // Grid lines + Y labels (relative frequency)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const v = (yMax / yTicks) * i;
      const y = padT + plotH - (v / yMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText((v * 100).toFixed(0) + '%', padL - 6, y);
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Bars
    const barGroupW = plotW / n;
    const barW = barGroupW * 0.78;
    const barOffset = (barGroupW - barW) / 2;

    for (let i = 0; i < n; i++) {
      const groupX = padL + i * barGroupW;
      const cx = groupX + barGroupW / 2;
      const baseY = padT + plotH;

      const empH = (empirical[i] / yMax) * plotH;
      const isLast = this.lastRoll !== null && labels[i] === this.lastRoll;

      // Empirical bar
      const grad = ctx.createLinearGradient(0, baseY - empH, 0, baseY);
      if (isLast) {
        grad.addColorStop(0, 'rgba(244,162,97,0.95)');
        grad.addColorStop(1, 'rgba(244,162,97,0.55)');
      } else {
        grad.addColorStop(0, 'rgba(38,139,210,0.85)');
        grad.addColorStop(1, 'rgba(38,139,210,0.45)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(groupX + barOffset, baseY - empH, barW, empH);

      // Bar outline
      ctx.strokeStyle = isLast ? 'rgba(244,162,97,1)' : 'rgba(38,139,210,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(groupX + barOffset, baseY - empH, barW, empH);

      // X-axis label
      ctx.fillStyle = isLast ? 'rgba(244,162,97,1)' : 'rgba(255,255,255,0.7)';
      ctx.font = isLast
        ? 'bold 13px ui-monospace, SFMono-Regular, monospace'
        : '12px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(labels[i]), cx, baseY + 6);

      // Empirical % label above bar (only when room and totalRolls > 0)
      if (this.totalRolls > 0 && empH > 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillText((empirical[i] * 100).toFixed(1) + '%', cx, baseY - empH - 2);
      }
    }

    // Theoretical overlay (dashed line + dots on top of each bar)
    if (this.showTheoretical) {
      ctx.strokeStyle = 'rgba(220,50,47,0.85)';
      ctx.fillStyle = 'rgba(220,50,47,1)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const cx = padL + i * barGroupW + barGroupW / 2;
        const y = padT + plotH - (theo[i] / yMax) * plotH;
        if (i === 0) ctx.moveTo(cx, y);
        else ctx.lineTo(cx, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < n; i++) {
        const cx = padL + i * barGroupW + barGroupW / 2;
        const y = padT + plotH - (theo[i] / yMax) * plotH;
        ctx.beginPath();
        ctx.arc(cx, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Y-axis title
    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('相對次數', 0, 0);
    ctx.restore();

    // X-axis title
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.mode === '1d6' ? '骰子點數' : '兩顆骰子點數和', padL + plotW / 2, h - 4);
  }
}
