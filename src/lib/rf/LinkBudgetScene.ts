/**
 * LinkBudgetScene — where the dB go.
 *
 * Two panels. The top one is a waterfall: start at the transmitter's output
 * power and walk left-to-right through every gain and loss until you land on
 * the received power, with the receiver's sensitivity drawn as the floor. The
 * bottom one sweeps distance on a log axis so the reader can see the received
 * power fall as a *straight line* — which is the whole reason engineers work
 * in dB in the first place.
 *
 * Everything is computed from radio.ts, so the numbers match what a datasheet
 * would tell you rather than being tuned to look tidy.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import {
  fsplDb,
  solveLink,
  getRadioPreset,
  RADIO_PRESETS,
  type LinkBudget,
  type LinkResult,
} from './radio';

const MIN_KM = 0.01;
const MAX_KM = 2000;

export interface LinkBudgetStats extends LinkResult {
  presetId: string;
  freqMHz: number;
  distanceKm: number;
  budget: LinkBudget;
  wavelengthCm: number;
}

export interface LinkBudgetSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: LinkBudgetStats) => void;
}

interface Step {
  label: string;
  delta: number;
  color: string;
}

export class LinkBudgetScene extends Canvas2DBase {
  private presetId = 'lora-longfast';
  private freqMHz = 923;
  private distanceKm = 5;
  private budget: LinkBudget = { ...getRadioPreset('lora-longfast').budget };

  private readonly onStats?: (s: LinkBudgetStats) => void;

  constructor(options: LinkBudgetSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.applyPreset('lora-longfast');
  }

  // ─────────────────────────────────────────── controls

  public applyPreset(id: string): void {
    const p = getRadioPreset(id);
    this.presetId = p.id;
    this.freqMHz = p.freqMHz;
    this.budget = { ...p.budget };
    this.distanceKm = Math.min(MAX_KM, Math.max(MIN_KM, this.result().maxRangeKm * 0.35));
    this.emit();
    this.scheduleRender();
  }

  public setFrequency(mhz: number): void { this.freqMHz = mhz; this.presetId = 'custom'; this.emit(); this.scheduleRender(); }
  public setDistance(km: number): void { this.distanceKm = km; this.emit(); this.scheduleRender(); }

  public setBudgetField(field: keyof LinkBudget, value: number): void {
    this.budget = { ...this.budget, [field]: value };
    this.presetId = 'custom';
    this.emit();
    this.scheduleRender();
  }

  /** Jump the distance slider to exactly where the margin runs out. */
  public snapToMaxRange(): void {
    this.distanceKm = Math.min(MAX_KM, Math.max(MIN_KM, this.result().maxRangeKm));
    this.emit();
    this.scheduleRender();
  }

  private result(): LinkResult {
    return solveLink(this.budget, this.distanceKm, this.freqMHz);
  }

  private emit(): void {
    const r = this.result();
    this.onStats?.({
      ...r,
      presetId: this.presetId,
      freqMHz: this.freqMHz,
      distanceKm: this.distanceKm,
      budget: { ...this.budget },
      wavelengthCm: (299_792_458 / (this.freqMHz * 1e6)) * 100,
    });
  }

  private steps(): Step[] {
    const b = this.budget;
    return [
      { label: '發射功率', delta: b.txPowerDbm, color: '#268bd2' },
      { label: '發射天線增益', delta: b.txGainDbi, color: '#859900' },
      { label: '發射端損耗', delta: -b.txLossDb, color: '#cb4b16' },
      { label: '路徑損耗 FSPL', delta: -fsplDb(this.distanceKm, this.freqMHz), color: '#dc322f' },
      { label: '接收天線增益', delta: b.rxGainDbi, color: '#859900' },
      { label: '接收端損耗', delta: -b.rxLossDb, color: '#cb4b16' },
    ];
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const gap = 10;
    const topH = Math.max(150, this.height * 0.52);
    this.drawWaterfall(0, topH);
    ctx.strokeStyle = 'rgba(88,110,117,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, topH + gap / 2);
    ctx.lineTo(this.width, topH + gap / 2);
    ctx.stroke();
    this.drawRangeCurve(topH + gap, this.height - topH - gap);
  }

  private drawWaterfall(oy: number, h: number): void {
    const ctx = this.ctx;
    const padL = 52;
    const padR = 16;
    const padT = 28;
    const padB = 44;
    const pw = this.width - padL - padR;
    const ph = h - padT - padB;
    const y0 = oy + padT;

    const steps = this.steps();
    const r = this.result();

    // vertical scale spans everything the walk touches, plus the floor
    let level = 0;
    const levels: number[] = [0];
    for (const s of steps) { level += s.delta; levels.push(level); }
    const lo = Math.min(this.budget.sensitivityDbm, ...levels) - 8;
    const hi = Math.max(this.budget.sensitivityDbm, ...levels) + 8;
    const toY = (v: number) => y0 + ph - ((v - lo) / (hi - lo)) * ph;

    // sensitivity floor
    const sy = toY(this.budget.sensitivityDbm);
    ctx.fillStyle = 'rgba(220,50,47,0.10)';
    ctx.fillRect(padL, sy, pw, y0 + ph - sy);
    ctx.strokeStyle = '#dc322f';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padL, sy);
    ctx.lineTo(padL + pw, sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#dc322f';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`接收靈敏度 ${this.budget.sensitivityDbm.toFixed(0)} dBm — 低於這條線就解不出來`, padL + 4, sy - 3);

    // axis ticks every 20 dB
    ctx.strokeStyle = 'rgba(88,110,117,0.25)';
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tick = 20;
    for (let v = Math.ceil(lo / tick) * tick; v <= hi; v += tick) {
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pw, y);
      ctx.stroke();
      ctx.fillText(`${v}`, padL - 6, y);
    }

    // the walk itself
    const n = steps.length + 1;
    const slot = pw / n;
    const barW = Math.min(slot * 0.62, 74);
    let cur = 0;
    ctx.textAlign = 'center';
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const next = cur + s.delta;
      const cx = padL + slot * (i + 0.5);
      const yTop = toY(Math.max(cur, next));
      const yBot = toY(Math.min(cur, next));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(cx - barW / 2, yTop, barW, Math.max(2, yBot - yTop));
      ctx.globalAlpha = 1;

      // connector to the next bar
      ctx.strokeStyle = 'rgba(253,246,227,0.3)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - barW / 2, toY(cur));
      ctx.lineTo(cx - slot * 0.5 + barW / 2, toY(cur));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(253,246,227,0.9)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textBaseline = 'bottom';
      const labelY = Math.min(yTop - 4, y0 + ph - 4);
      ctx.fillText(`${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}`, cx, labelY);
      ctx.fillStyle = 'rgba(147,161,161,0.85)';
      ctx.textBaseline = 'top';
      this.wrapLabel(s.label, cx, y0 + ph + 6, slot);
      cur = next;
    }

    // final received-power column
    const cx = padL + slot * (steps.length + 0.5);
    const ry = toY(r.rxPowerDbm);
    const ok = r.marginDb >= 0;
    ctx.fillStyle = ok ? '#859900' : '#dc322f';
    ctx.fillRect(cx - barW / 2, ry - 3, barW, 6);
    ctx.fillStyle = ok ? '#859900' : '#dc322f';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${r.rxPowerDbm.toFixed(1)}`, cx, ry - 6);
    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    this.wrapLabel('接收功率', cx, y0 + ph + 6, slot);

    // margin bracket between received power and sensitivity. The last column
    // sits at the right edge, so the bracket flips to the inside when there is
    // not enough room — otherwise the rotated label runs off the canvas.
    if (Math.abs(ry - sy) > 10) {
      ctx.strokeStyle = ok ? '#859900' : '#dc322f';
      ctx.lineWidth = 1.4;
      const outside = cx + barW / 2 + 8;
      const flip = outside + 16 > padL + pw;
      const bx = flip ? cx - barW / 2 - 8 : outside;
      ctx.beginPath();
      ctx.moveTo(bx, ry);
      ctx.lineTo(bx, sy);
      ctx.stroke();
      ctx.save();
      ctx.translate(bx + (flip ? -4 : 4), (ry + sy) / 2);
      ctx.fillStyle = ok ? '#859900' : '#dc322f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.rotate(flip ? -Math.PI / 2 : Math.PI / 2);
      ctx.fillText(`餘裕 ${r.marginDb >= 0 ? '+' : ''}${r.marginDb.toFixed(1)} dB`, 0, 0);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('功率預算（dBm）', padL, oy + 6);
  }

  private wrapLabel(text: string, cx: number, y: number, maxW: number): void {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxW) {
      ctx.fillText(text, cx, y);
      return;
    }
    const mid = Math.ceil(text.length / 2);
    ctx.fillText(text.slice(0, mid), cx, y);
    ctx.fillText(text.slice(mid), cx, y + 12);
  }

  private drawRangeCurve(oy: number, h: number): void {
    if (h < 60) return;
    const ctx = this.ctx;
    const padL = 52;
    const padR = 16;
    const padT = 18;
    const padB = 26;
    const pw = this.width - padL - padR;
    const ph = h - padT - padB;
    const y0 = oy + padT;

    const r = this.result();
    const lo = this.budget.sensitivityDbm - 30;
    const hi = r.eirpDbm + 6;
    const toY = (v: number) => y0 + ph - ((v - lo) / (hi - lo)) * ph;
    const logMin = Math.log10(MIN_KM);
    const logMax = Math.log10(MAX_KM);
    const toX = (km: number) => padL + ((Math.log10(km) - logMin) / (logMax - logMin)) * pw;

    // decade gridlines
    ctx.strokeStyle = 'rgba(88,110,117,0.25)';
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let e = -2; e <= 3; e++) {
      const km = Math.pow(10, e);
      if (km < MIN_KM || km > MAX_KM) continue;
      const x = toX(km);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + ph);
      ctx.stroke();
      ctx.fillText(km >= 1 ? `${km} km` : `${km * 1000} m`, x, y0 + ph + 4);
    }

    // sensitivity floor
    const sy = toY(this.budget.sensitivityDbm);
    ctx.strokeStyle = '#dc322f';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(padL, sy);
    ctx.lineTo(padL + pw, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // received power vs distance — a straight line, because dB
    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const cols = 240;
    for (let i = 0; i <= cols; i++) {
      const km = Math.pow(10, logMin + ((logMax - logMin) * i) / cols);
      const rx = solveLink(this.budget, km, this.freqMHz).rxPowerDbm;
      const x = toX(km);
      const y = toY(rx);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // max range marker
    if (r.maxRangeKm >= MIN_KM && r.maxRangeKm <= MAX_KM) {
      const mx = toX(r.maxRangeKm);
      ctx.strokeStyle = 'rgba(181,137,0,0.85)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, y0);
      ctx.lineTo(mx, y0 + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b58900';
      ctx.textAlign = mx > padL + pw * 0.7 ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('理論最大距離', mx + (mx > padL + pw * 0.7 ? -4 : 4), y0 + 2);
    }

    // current operating point
    if (this.distanceKm >= MIN_KM && this.distanceKm <= MAX_KM) {
      const cx = toX(this.distanceKm);
      const cy = toY(r.rxPowerDbm);
      ctx.fillStyle = r.marginDb >= 0 ? '#859900' : '#dc322f';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(253,246,227,0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('接收功率 vs 距離（對數軸 → 直線）', padL, oy + 2);
  }
}

export { RADIO_PRESETS };
