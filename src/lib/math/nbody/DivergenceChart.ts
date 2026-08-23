/**
 * DivergenceChart — log₁₀ d(t) for the twin run.
 *
 * This is the panel that turns "the screen looks messy" into an actual claim.
 * Two identical systems started δ apart:
 *   - regular motion (2 bodies, hierarchical 3 bodies) ⇒ d grows like a power
 *     of t, so on a log axis the curve visibly *bends over* and flattens;
 *   - chaotic motion ⇒ d grows like e^{λt}, so on a log axis it is a straight
 *     line, right up until it saturates at the size of the system itself.
 *
 * The fitted straight line drawn over the growth phase gives λ̂ — a
 * finite-time estimate, not a true Lyapunov exponent, and labelled as such
 * on the page.
 */
import { Canvas2DBase } from '../Canvas2DBase';

export interface DivergenceFit {
  lambda: number;
  /** Natural-log intercept: ln d ≈ intercept + lambda · t */
  intercept: number;
  tStart: number;
  tEnd: number;
}

export interface DivergenceSeries {
  times: readonly number[];
  distances: readonly number[];
  delta0: number;
  /** System scale — where d stops growing because it has run out of room. */
  saturation: number;
  fit: DivergenceFit | null;
}

const PAD_LEFT = 46;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

function powerLabel(exp: number): string {
  return `10${String(exp).split('').map((c) => SUPERSCRIPT[c] ?? c).join('')}`;
}

export class DivergenceChart extends Canvas2DBase {
  private series: DivergenceSeries = {
    times: [],
    distances: [],
    delta0: 1e-6,
    saturation: 1,
    fit: null,
  };

  public setSeries(series: DivergenceSeries): void {
    this.series = series;
  }

  protected draw(): void {
    const { ctx, width, height } = this;
    const plotW = Math.max(10, width - PAD_LEFT - PAD_RIGHT);
    const plotH = Math.max(10, height - PAD_TOP - PAD_BOTTOM);
    const { times, distances, delta0, saturation, fit } = this.series;

    const tMax = times.length > 0 ? Math.max(times[times.length - 1], 1) : 1;
    const yMin = Math.floor(Math.log10(Math.max(delta0, 1e-16))) - 1;
    const yMax = Math.ceil(Math.log10(Math.max(saturation, delta0 * 10))) + 1;

    const toX = (t: number) => PAD_LEFT + (t / tMax) * plotW;
    const toY = (logd: number) =>
      PAD_TOP + plotH - ((logd - yMin) / Math.max(1e-9, yMax - yMin)) * plotH;

    ctx.fillStyle = '#00212b';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const span = yMax - yMin;
    const step = span > 10 ? 3 : span > 6 ? 2 : 1;
    for (let e = Math.ceil(yMin); e <= yMax; e += step) {
      const y = toY(e);
      ctx.strokeStyle = e === 0 ? 'rgba(147,161,161,0.28)' : 'rgba(88,110,117,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(PAD_LEFT + plotW, y);
      ctx.stroke();
      ctx.fillStyle = '#657b83';
      ctx.fillText(powerLabel(e), PAD_LEFT - 6, y);
    }

    // Saturation line — above it, the two runs are simply unrelated systems.
    const satY = toY(Math.log10(Math.max(saturation, 1e-16)));
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(203,75,22,0.55)';
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, satY);
    ctx.lineTo(PAD_LEFT + plotW, satY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(88,110,117,0.6)';
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP);
    ctx.lineTo(PAD_LEFT, PAD_TOP + plotH);
    ctx.lineTo(PAD_LEFT + plotW, PAD_TOP + plotH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#657b83';
    ctx.fillText('t = 0', PAD_LEFT + 2, PAD_TOP + plotH + 11);
    ctx.textAlign = 'right';
    ctx.fillText(`t = ${tMax.toFixed(1)}`, PAD_LEFT + plotW, PAD_TOP + plotH + 11);

    if (times.length < 2) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#586e75';
      ctx.fillText('播放後開始記錄雙軌分離距離 d(t)', PAD_LEFT + plotW / 2, PAD_TOP + plotH / 2);
      return;
    }

    if (fit) {
      ctx.strokeStyle = 'rgba(181,137,0,0.75)';
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const y0 = (fit.intercept + fit.lambda * fit.tStart) / Math.LN10;
      const y1 = (fit.intercept + fit.lambda * fit.tEnd) / Math.LN10;
      ctx.moveTo(toX(fit.tStart), toY(y0));
      ctx.lineTo(toX(fit.tEnd), toY(y1));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#d33682';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < times.length; i++) {
      const d = Math.max(distances[i], 1e-16);
      const x = toX(times[i]);
      const y = toY(Math.log10(d));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
