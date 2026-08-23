/**
 * InverseSquareScene — the warm-up on the /physics/rf/ landing page.
 *
 * Drag the receiver. Power falls as 1/d², which on a linear bar collapses to
 * nothing almost immediately and tells you nothing useful — and on a dB scale
 * becomes a straight line you can do arithmetic on. That contrast is the whole
 * reason radio engineering is done in decibels, and it is worth feeling once
 * before the link-budget lesson starts stacking dB terms.
 *
 * The one number to take away: doubling the distance costs exactly 6.02 dB,
 * whatever the frequency, whatever the power.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

const REF_M = 1;

export interface InverseSquareStats {
  distanceM: number;
  /** power relative to the 1 m reference, linear */
  relativePower: number;
  relativeDb: number;
  doublingCostDb: number;
}

export interface InverseSquareSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: InverseSquareStats) => void;
}

export class InverseSquareScene extends Canvas2DBase {
  private distanceM = 8;
  private maxM = 64;
  private dragging = false;
  private readonly onStats?: (s: InverseSquareStats) => void;

  constructor(options: InverseSquareSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.style.touchAction = 'none';
    this.emit();
  }

  public override destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    super.destroy();
  }

  public setDistance(m: number): void {
    this.distanceM = Math.max(REF_M, Math.min(this.maxM, m));
    this.emit();
  }

  private emit(): void {
    const rel = (REF_M / this.distanceM) ** 2;
    this.onStats?.({
      distanceM: this.distanceM,
      relativePower: rel,
      relativeDb: 10 * Math.log10(rel),
      doublingCostDb: 10 * Math.log10(0.25),
    });
    this.scheduleRender();
  }

  private layout() {
    return { padL: 46, padR: 24, topH: this.height * 0.44 };
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.applyDrag(e);
    e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.applyDrag(e);
    e.preventDefault();
  };

  private onUp = (e: PointerEvent) => {
    if (this.dragging) this.canvas.releasePointerCapture(e.pointerId);
    this.dragging = false;
  };

  private applyDrag(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const { padL, padR } = this.layout();
    const pw = this.width - padL - padR;
    const f = Math.max(0, Math.min(1, (e.clientX - r.left - padL) / pw));
    // log spacing so the near field is not a single pixel
    this.setDistance(Math.pow(this.maxM, f) || REF_M);
  }

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const { padL, padR, topH } = this.layout();
    const pw = this.width - padL - padR;
    if (pw < 60) return;

    const toX = (m: number) => padL + (Math.log(Math.max(REF_M, m)) / Math.log(this.maxM)) * pw;
    const y = topH * 0.55;

    // spreading wavefronts
    ctx.strokeStyle = 'rgba(38,139,210,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
      const r = (i / 7) * (pw * 0.9);
      ctx.beginPath();
      ctx.arc(padL, y, r, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }

    ctx.fillStyle = '#b58900';
    ctx.beginPath();
    ctx.arc(padL, y, 7, 0, Math.PI * 2);
    ctx.fill();

    const rx = toX(this.distanceM);
    ctx.fillStyle = '#2aa198';
    ctx.beginPath();
    ctx.arc(rx, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253,246,227,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88,110,117,0.6)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(rx, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.distanceM.toFixed(1)} m`, rx, y + 12);
    ctx.textAlign = 'left';
    ctx.fillText('發射端', padL - 4, y + 12);
    ctx.fillText('拖曳畫面移動接收端', padL, 6);

    // two bars for the same number
    const barTop = topH + 14;
    const barH = 16;
    const rel = (REF_M / this.distanceM) ** 2;
    const db = 10 * Math.log10(rel);

    const drawBar = (label: string, frac: number, value: string, yy: number, color: string) => {
      ctx.fillStyle = 'rgba(147,161,161,0.8)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, padL, yy - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(padL, yy, pw, barH);
      ctx.fillStyle = color;
      ctx.fillRect(padL, yy, Math.max(1, pw * Math.max(0, Math.min(1, frac))), barH);
      ctx.fillStyle = 'rgba(253,246,227,0.95)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, padL + pw - 6, yy + barH / 2);
    };

    drawBar('線性刻度：接收功率 ÷ 1 m 處的功率', rel, rel < 0.001 ? rel.toExponential(1) : rel.toFixed(4), barTop, '#268bd2');
    // map 0 … −60 dB onto the bar
    drawBar('dB 刻度：同一個數字', 1 + db / 60, `${db.toFixed(1)} dB`, barTop + barH + 30, '#2aa198');

    // the 6 dB ladder
    const ladderY = barTop + (barH + 30) * 2 + 6;
    if (ladderY + 26 < this.height) {
      ctx.strokeStyle = 'rgba(88,110,117,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, ladderY + 10);
      ctx.lineTo(padL + pw, ladderY + 10);
      ctx.stroke();
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let m = 1; m <= this.maxM; m *= 2) {
        const x = toX(m);
        ctx.strokeStyle = 'rgba(88,110,117,0.6)';
        ctx.beginPath();
        ctx.moveTo(x, ladderY + 6);
        ctx.lineTo(x, ladderY + 14);
        ctx.stroke();
        ctx.fillStyle = 'rgba(147,161,161,0.75)';
        ctx.fillText(`${m}m`, x, ladderY + 16);
        ctx.fillStyle = 'rgba(181,137,0,0.9)';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${(10 * Math.log10(1 / (m * m))).toFixed(0)}`, x, ladderY + 4);
        ctx.textBaseline = 'top';
      }
      ctx.fillStyle = 'rgba(181,137,0,0.9)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('每次距離加倍 = −6.02 dB', padL, ladderY - 2);
    }
  }
}
