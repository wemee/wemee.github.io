/**
 * ResonanceScene — the warm-up widget on the /physics/ landing page.
 *
 * A driven damped oscillator:  ẍ + 2γẋ + ω₀²x = F cos(ω_d t)
 *
 * The animation integrates the equation (RK4) so the transient is visible —
 * the mass does not snap to its steady state, it rings up into it. The curve
 * underneath is the analytic steady-state amplitude
 *
 *     A(ω_d) = F / √((ω₀² − ω_d²)² + (2γω_d)²)
 *
 * so the reader can watch the measured swing walk along a curve that was
 * derived, not fitted. It exists to make one point before the lessons start:
 * a small change in one number (ω_d) can change behaviour qualitatively.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

const OMEGA_0 = 1;
const FORCE = 1;
const DT = 0.004;
const STEPS_PER_FRAME = 8;
const WD_MIN = 0.05;
const WD_MAX = 2.5;

export interface ResonanceStats {
  driveFrequency: number;
  damping: number;
  steadyAmplitude: number;
  phaseLagDeg: number;
  qualityFactor: number;
}

export interface ResonanceSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: ResonanceStats) => void;
}

export class ResonanceScene extends Canvas2DBase {
  private wd = 1;
  private gamma = 0.08;
  private x = 0;
  private v = 0;
  private t = 0;
  private rafId: number | null = null;
  private readonly onStats?: (s: ResonanceStats) => void;

  constructor(options: ResonanceSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
    this.emit();
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    super.destroy();
  }

  private accel(x: number, v: number, t: number): number {
    return FORCE * Math.cos(this.wd * t) - 2 * this.gamma * v - OMEGA_0 * OMEGA_0 * x;
  }

  private step(): void {
    const { x, v, t } = this;
    const a1 = this.accel(x, v, t);
    const a2 = this.accel(x + (v * DT) / 2, v + (a1 * DT) / 2, t + DT / 2);
    const a3 = this.accel(x + ((v + (a1 * DT) / 2) * DT) / 2, v + (a2 * DT) / 2, t + DT / 2);
    const a4 = this.accel(x + (v + (a2 * DT) / 2) * DT, v + a3 * DT, t + DT);
    this.x = x + (DT / 6) * (6 * v + DT * (a1 + a2 + a3));
    this.v = v + (DT / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    this.t += DT;
  }

  private amplitudeAt(wd: number): number {
    const d = OMEGA_0 * OMEGA_0 - wd * wd;
    return FORCE / Math.sqrt(d * d + (2 * this.gamma * wd) ** 2);
  }

  private phaseLag(): number {
    const d = OMEGA_0 * OMEGA_0 - this.wd * this.wd;
    return (Math.atan2(2 * this.gamma * this.wd, d) * 180) / Math.PI;
  }

  public setDriveFrequency(wd: number): void {
    this.wd = wd;
    this.emit();
  }

  public setDamping(g: number): void {
    this.gamma = g;
    this.emit();
  }

  public reset(): void {
    this.x = 0;
    this.v = 0;
    this.t = 0;
  }

  private emit(): void {
    this.onStats?.({
      driveFrequency: this.wd,
      damping: this.gamma,
      steadyAmplitude: this.amplitudeAt(this.wd),
      phaseLagDeg: this.phaseLag(),
      qualityFactor: OMEGA_0 / (2 * this.gamma),
    });
  }

  private loop(): void {
    this.rafId = requestAnimationFrame(this.loop);
    for (let i = 0; i < STEPS_PER_FRAME; i++) this.step();
    this.scheduleRender();
  }

  protected draw(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, W, H);

    const topH = Math.max(80, H * 0.42);
    this.drawMass(0, topH);
    this.drawCurve(topH + 6, H - topH - 6);
  }

  private drawMass(oy: number, h: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const midY = oy + h * 0.55;
    const restX = W * 0.5;
    // clamp the drawn amplitude so a sharp resonance does not fly off-canvas
    const peak = Math.max(1, this.amplitudeAt(OMEGA_0));
    const scale = Math.min(W * 0.3, 190) / Math.max(2, peak);
    const px = restX + Math.max(-W * 0.34, Math.min(W * 0.34, this.x * scale));

    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(restX, midY - h * 0.3);
    ctx.lineTo(restX, midY + h * 0.3);
    ctx.stroke();
    ctx.setLineDash([]);

    // wall + spring
    const wallX = W * 0.08;
    ctx.fillStyle = 'rgba(88,110,117,0.6)';
    ctx.fillRect(wallX - 10, midY - h * 0.26, 10, h * 0.52);
    ctx.strokeStyle = 'rgba(147,161,161,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, midY);
    const coils = 12;
    for (let i = 1; i <= coils * 2; i++) {
      const cxp = wallX + ((px - 20 - wallX) * i) / (coils * 2);
      ctx.lineTo(cxp, midY + (i % 2 === 0 ? 0 : i % 4 === 1 ? -9 : 9));
    }
    ctx.lineTo(px - 20, midY);
    ctx.stroke();

    ctx.fillStyle = '#268bd2';
    ctx.strokeStyle = 'rgba(253,246,227,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px - 20, midY - 17, 40, 34, 6);
    ctx.fill();
    ctx.stroke();

    // driving force arrow
    const f = Math.cos(this.wd * this.t);
    const arrowLen = f * 46;
    ctx.strokeStyle = '#b58900';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(px, midY - 34);
    ctx.lineTo(px + arrowLen, midY - 34);
    ctx.stroke();
    if (Math.abs(arrowLen) > 6) {
      const dir = Math.sign(arrowLen);
      ctx.fillStyle = '#b58900';
      ctx.beginPath();
      ctx.moveTo(px + arrowLen + dir * 7, midY - 34);
      ctx.lineTo(px + arrowLen, midY - 39);
      ctx.lineTo(px + arrowLen, midY - 29);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('外力 F cos(ω_d t)', wallX, oy + 6);
  }

  private drawCurve(oy: number, h: number): void {
    if (h < 50) return;
    const ctx = this.ctx;
    const padL = 40;
    const padR = 14;
    const padT = 8;
    const padB = 20;
    const pw = this.width - padL - padR;
    const ph = h - padT - padB;
    const y0 = oy + padT;

    let peak = 0;
    const samples = 220;
    const amps: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const wd = WD_MIN + ((WD_MAX - WD_MIN) * i) / samples;
      const a = this.amplitudeAt(wd);
      amps.push(a);
      peak = Math.max(peak, a);
    }
    const toX = (wd: number) => padL + ((wd - WD_MIN) / (WD_MAX - WD_MIN)) * pw;
    const toY = (a: number) => y0 + ph - (a / (peak || 1)) * ph * 0.92;

    ctx.strokeStyle = 'rgba(88,110,117,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y0 + ph);
    ctx.lineTo(padL + pw, y0 + ph);
    ctx.stroke();

    // natural frequency
    ctx.strokeStyle = 'rgba(220,50,47,0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(OMEGA_0), y0);
    ctx.lineTo(toX(OMEGA_0), y0 + ph);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.beginPath();
    amps.forEach((a, i) => {
      const wd = WD_MIN + ((WD_MAX - WD_MIN) * i) / samples;
      const px = toX(wd);
      const py = toY(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const cur = this.amplitudeAt(this.wd);
    ctx.fillStyle = '#b58900';
    ctx.beginPath();
    ctx.arc(toX(this.wd), toY(cur), 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(147,161,161,0.75)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let wd = 0.5; wd <= WD_MAX; wd += 0.5) ctx.fillText(wd.toFixed(1), toX(wd), y0 + ph + 4);
    ctx.textAlign = 'left';
    ctx.fillText('穩態振幅 A(ω_d)', padL + 2, y0 + 2);
    ctx.textAlign = 'right';
    ctx.fillText('驅動頻率 ω_d', padL + pw, y0 + ph + 4);
    ctx.fillStyle = 'rgba(220,50,47,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ω₀', toX(OMEGA_0), y0 + 2);
  }
}
