/**
 * FresnelScene — why line of sight is not enough.
 *
 * A radio link is not a laser beam. The energy travels through an ellipsoidal
 * volume around the straight line, and anything intruding into the first
 * Fresnel zone starts stealing from it — even when the obstacle is nowhere
 * near blocking the visual line. This is the same diffraction the reader met
 * at /physics/double-slit, with a mountain instead of a slit.
 *
 * Loss comes from the ITU-R P.526 knife-edge approximation in radio.ts, and
 * the earth-bulge option uses the standard k = 4/3 effective-radius model
 * (bulge_m = d1_km · d2_km / 17), which is what turns a link that works on
 * paper at 5 km into one that fails at 40 km.
 *
 * The drawing is vertically exaggerated by a large factor — metres against
 * kilometres — and says so on the canvas, because a terrain profile that
 * hides its own exaggeration is how people talk themselves into bad links.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import { fresnelRadiusM, fresnelParameter, knifeEdgeLossDb, fsplDb, wavelengthM } from './radio';

const K_FACTOR = 4 / 3;

export interface FresnelStats {
  freqMHz: number;
  linkKm: number;
  txHeightM: number;
  rxHeightM: number;
  obstacleFraction: number;
  obstacleHeightM: number;
  earthCurvature: boolean;
  /** first-Fresnel-zone radius at the obstacle, metres */
  radiusM: number;
  /** obstacle tip height above the line of sight, metres (negative = below) */
  clearanceHeightM: number;
  /** fraction of the first zone that is clear; the rule of thumb wants ≥ 0.6 */
  clearanceRatio: number;
  nu: number;
  diffractionLossDb: number;
  fsplDb: number;
  totalLossDb: number;
  bulgeM: number;
  wavelengthM: number;
}

export interface FresnelSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: FresnelStats) => void;
}

export class FresnelScene extends Canvas2DBase {
  private freqMHz = 923;
  private linkKm = 12;
  private txHeightM = 30;
  private rxHeightM = 10;
  private obstacleFraction = 0.5;
  private obstacleHeightM = 60;
  private earthCurvature = true;

  private dragging = false;
  private readonly onStats?: (s: FresnelStats) => void;

  constructor(options: FresnelSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.style.touchAction = 'none';
    this.emit();
  }

  public override destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    super.destroy();
  }

  // ─────────────────────────────────────────── model

  private geometry() {
    const d1M = this.linkKm * 1000 * this.obstacleFraction;
    const d2M = this.linkKm * 1000 * (1 - this.obstacleFraction);
    // effective-earth bulge at the obstacle, k = 4/3
    const bulge = this.earthCurvature
      ? ((d1M / 1000) * (d2M / 1000)) / (12.75 * K_FACTOR)
      : 0;
    // straight line from antenna tip to antenna tip
    const losHeight = this.txHeightM + (this.rxHeightM - this.txHeightM) * this.obstacleFraction;
    // the obstacle rides up on the bulge
    const tip = this.obstacleHeightM + bulge;
    const radius = fresnelRadiusM(d1M, d2M, this.freqMHz);
    const h = tip - losHeight;
    const nu = fresnelParameter(h, d1M, d2M, this.freqMHz);
    const diff = knifeEdgeLossDb(nu);
    const fspl = fsplDb(this.linkKm, this.freqMHz);
    return {
      d1M, d2M, bulge, losHeight, tip, radius, h, nu,
      diff, fspl,
      clearanceRatio: radius > 0 ? -h / radius : 0,
    };
  }

  private emit(): void {
    const g = this.geometry();
    this.onStats?.({
      freqMHz: this.freqMHz,
      linkKm: this.linkKm,
      txHeightM: this.txHeightM,
      rxHeightM: this.rxHeightM,
      obstacleFraction: this.obstacleFraction,
      obstacleHeightM: this.obstacleHeightM,
      earthCurvature: this.earthCurvature,
      radiusM: g.radius,
      clearanceHeightM: g.h,
      clearanceRatio: g.clearanceRatio,
      nu: g.nu,
      diffractionLossDb: g.diff,
      fsplDb: g.fspl,
      totalLossDb: g.fspl + g.diff,
      bulgeM: g.bulge,
      wavelengthM: wavelengthM(this.freqMHz),
    });
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── controls

  public setFrequency(mhz: number): void { this.freqMHz = mhz; this.emit(); }
  public setLinkKm(km: number): void { this.linkKm = km; this.emit(); }
  public setTxHeight(m: number): void { this.txHeightM = m; this.emit(); }
  public setRxHeight(m: number): void { this.rxHeightM = m; this.emit(); }
  public setObstacleFraction(f: number): void { this.obstacleFraction = Math.min(0.95, Math.max(0.05, f)); this.emit(); }
  public setObstacleHeight(m: number): void { this.obstacleHeightM = m; this.emit(); }
  public setEarthCurvature(on: boolean): void { this.earthCurvature = on; this.emit(); }

  /** Raise the near antenna until the 60 % clearance rule is satisfied. */
  public solveForClearance(): void {
    const target = 0.6;
    for (let i = 0; i < 400; i++) {
      const g = this.geometry();
      if (g.clearanceRatio >= target) break;
      this.txHeightM = Math.min(400, this.txHeightM + 1);
      if (this.txHeightM >= 400) break;
    }
    this.emit();
  }

  // ─────────────────────────────────────────── pointer

  private layout() {
    const padL = 46;
    const padR = 20;
    const padT = 26;
    const padB = 34;
    return { padL, padR, padT, padB, pw: this.width - padL - padR, ph: this.height - padT - padB };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.applyDrag(e);
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.applyDrag(e);
    e.preventDefault();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragging) this.canvas.releasePointerCapture(e.pointerId);
    this.dragging = false;
  };

  private applyDrag(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const { padL, pw } = this.layout();
    const f = (e.clientX - r.left - padL) / pw;
    this.setObstacleFraction(f);
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const { padL, padT, padB, pw, ph } = this.layout();
    if (pw < 60 || ph < 60) return;

    const g = this.geometry();
    const baseY = padT + ph;
    const maxH = Math.max(this.txHeightM, this.rxHeightM, g.tip + g.radius, 20) * 1.25;
    const toY = (m: number) => baseY - (m / maxH) * ph;
    const toX = (frac: number) => padL + frac * pw;
    const vScale = ph / maxH;                    // px per metre
    const hScale = pw / (this.linkKm * 1000);    // px per metre horizontally
    const exaggeration = vScale / hScale;

    // ground
    ctx.fillStyle = 'rgba(88,110,117,0.25)';
    ctx.fillRect(padL, baseY, pw, padB - 10);
    ctx.strokeStyle = 'rgba(88,110,117,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(padL + pw, baseY);
    ctx.stroke();

    // first Fresnel ellipse around the line of sight
    ctx.beginPath();
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const d1 = this.linkKm * 1000 * f;
      const d2 = this.linkKm * 1000 * (1 - f);
      const r = fresnelRadiusM(d1, d2, this.freqMHz);
      const los = this.txHeightM + (this.rxHeightM - this.txHeightM) * f;
      const px = toX(f);
      const py = toY(los + r);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const f = i / steps;
      const d1 = this.linkKm * 1000 * f;
      const d2 = this.linkKm * 1000 * (1 - f);
      const r = fresnelRadiusM(d1, d2, this.freqMHz);
      const los = this.txHeightM + (this.rxHeightM - this.txHeightM) * f;
      ctx.lineTo(toX(f), toY(los - r));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(42,161,152,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,161,152,0.75)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // 60 % clearance ellipse — the practical rule
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const d1 = this.linkKm * 1000 * f;
      const d2 = this.linkKm * 1000 * (1 - f);
      const r = fresnelRadiusM(d1, d2, this.freqMHz) * 0.6;
      const los = this.txHeightM + (this.rxHeightM - this.txHeightM) * f;
      const px = toX(f);
      const py = toY(los - r);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(181,137,0,0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.setLineDash([]);

    // line of sight
    ctx.strokeStyle = 'rgba(253,246,227,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(this.txHeightM));
    ctx.lineTo(toX(1), toY(this.rxHeightM));
    ctx.stroke();

    // earth bulge, drawn as the ground rising in the middle
    if (this.earthCurvature) {
      ctx.beginPath();
      ctx.moveTo(toX(0), baseY);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const d1 = (this.linkKm * f);
        const d2 = (this.linkKm * (1 - f));
        const b = (d1 * d2) / (12.75 * K_FACTOR);
        ctx.lineTo(toX(f), toY(b));
      }
      ctx.lineTo(toX(1), baseY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(88,110,117,0.35)';
      ctx.fill();
    }

    // the obstacle
    const ox = toX(this.obstacleFraction);
    const oyTip = toY(g.tip);
    const halfW = Math.max(10, pw * 0.045);
    ctx.beginPath();
    ctx.moveTo(ox - halfW, baseY);
    ctx.lineTo(ox, oyTip);
    ctx.lineTo(ox + halfW, baseY);
    ctx.closePath();
    const blocking = g.clearanceRatio < 0.6;
    ctx.fillStyle = blocking ? 'rgba(220,50,47,0.5)' : 'rgba(133,153,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = blocking ? '#dc322f' : '#859900';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // masts
    for (const [f, hM, label] of [[0, this.txHeightM, 'Tx'], [1, this.rxHeightM, 'Rx']] as [number, number, string][]) {
      const px = toX(f);
      ctx.strokeStyle = '#268bd2';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px, baseY);
      ctx.lineTo(px, toY(hM));
      ctx.stroke();
      ctx.fillStyle = '#268bd2';
      ctx.beginPath();
      ctx.arc(px, toY(hM), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = f === 0 ? 'left' : 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(147,161,161,0.9)';
      ctx.fillText(`${label} ${hM.toFixed(0)} m`, px + (f === 0 ? 4 : -4), toY(hM) - 6);
    }

    // labels
    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`第一菲涅耳區 r₁ = ${g.radius.toFixed(1)} m（障礙物處）`, padL + 2, padT - 18);
    ctx.textAlign = 'right';
    ctx.fillText(`垂直放大 ${exaggeration.toFixed(0)}×`, padL + pw, padT - 18);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;
      ctx.fillStyle = 'rgba(147,161,161,0.7)';
      ctx.fillText(`${(this.linkKm * f).toFixed(1)} km`, toX(f), baseY + padB - 24);
    }

    ctx.fillStyle = blocking ? '#dc322f' : '#859900';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      blocking
        ? `淨空 ${(g.clearanceRatio * 100).toFixed(0)}% ‹ 60% → 繞射損耗 ${g.diff.toFixed(1)} dB`
        : `淨空 ${(g.clearanceRatio * 100).toFixed(0)}% ≥ 60% → 幾乎無額外損耗`,
      ox,
      oyTip - 8,
    );

    ctx.fillStyle = 'rgba(147,161,161,0.6)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('拖曳畫面可移動障礙物', padL + 2, baseY + padB - 12);
  }
}
