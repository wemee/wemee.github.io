/**
 * ShannonScene — the line nobody gets past.
 *
 *   C = B · log₂(1 + S/N)      bits per second
 *
 * Two panels, because the formula has two knobs and they behave completely
 * differently:
 *
 *   left  — C against SNR at fixed bandwidth. Above ~10 dB it is a straight
 *           line: every extra 3 dB of power buys one more bit per second per
 *           hertz. Diminishing, and you pay for power in battery.
 *   right — C against bandwidth at fixed *received power*. It saturates. Noise
 *           grows with bandwidth too, so C → S/(N₀ ln2) no matter how much
 *           spectrum you own. That ceiling surprises people.
 *
 * The real systems from radio.ts are plotted as points, and the page's punch
 * line is that LoRa sits at *negative* SNR — under the noise floor — and the
 * formula says that is perfectly legal, just slow.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';
import {
  shannonCapacity,
  noiseFloorDbm,
  dbToLinear,
  getRadioPreset,
  RADIO_PRESETS,
  type RadioPreset,
} from './radio';

const SNR_MIN_DB = -30;
const SNR_MAX_DB = 40;
/** −1.59 dB: the Eb/N₀ floor as bandwidth → ∞. */
export const SHANNON_LIMIT_EB_N0_DB = 10 * Math.log10(Math.LN2);

export interface ShannonStats {
  presetId: string;
  bandwidthHz: number;
  snrDb: number;
  capacityBps: number;
  actualBitrate: number;
  efficiencyPct: number;
  spectralEfficiency: number;
  noiseFloorDbm: number;
  signalDbm: number;
  /** capacity if bandwidth were infinite at the same received power */
  infiniteBandwidthBps: number;
  belowNoiseFloor: boolean;
}

export interface ShannonSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: ShannonStats) => void;
}

export class ShannonScene extends Canvas2DBase {
  private presetId = 'lora-longfast';
  private bandwidthHz = 250_000;
  private snrDb = -17.5;
  private actualBitrate = 1074;
  private noiseFigureDb = 6;

  private readonly onStats?: (s: ShannonStats) => void;

  constructor(options: ShannonSceneOptions) {
    super(options);
    this.onStats = options.onStats;
    this.applyPreset('lora-longfast');
  }

  // ─────────────────────────────────────────── model

  private preset(): RadioPreset | null {
    return RADIO_PRESETS.find((p) => p.id === this.presetId) ?? null;
  }

  public applyPreset(id: string): void {
    const p = getRadioPreset(id);
    this.presetId = p.id;
    this.bandwidthHz = p.bandwidthHz;
    this.snrDb = p.snrDb;
    this.actualBitrate = p.actualBitrate;
    this.emit();
  }

  public setBandwidth(hz: number): void { this.bandwidthHz = hz; this.presetId = 'custom'; this.emit(); }
  public setSnr(db: number): void { this.snrDb = db; this.presetId = 'custom'; this.emit(); }

  private capacity(): number {
    return shannonCapacity(this.bandwidthHz, dbToLinear(this.snrDb));
  }

  private emit(): void {
    const c = this.capacity();
    const noise = noiseFloorDbm(this.bandwidthHz, this.noiseFigureDb);
    const signal = noise + this.snrDb;
    // C∞ = S/(N₀ ln2) — same received power, infinite bandwidth
    const n0 = dbToLinear(noise) / this.bandwidthHz; // mW/Hz
    const s = dbToLinear(signal); // mW
    this.onStats?.({
      presetId: this.presetId,
      bandwidthHz: this.bandwidthHz,
      snrDb: this.snrDb,
      capacityBps: c,
      actualBitrate: this.presetId === 'custom' ? Number.NaN : this.actualBitrate,
      efficiencyPct: this.presetId === 'custom' || c <= 0 ? Number.NaN : (this.actualBitrate / c) * 100,
      spectralEfficiency: this.bandwidthHz > 0 ? c / this.bandwidthHz : 0,
      noiseFloorDbm: noise,
      signalDbm: signal,
      infiniteBandwidthBps: n0 > 0 ? s / (n0 * Math.LN2) : Infinity,
      belowNoiseFloor: this.snrDb < 0,
    });
    this.scheduleRender();
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, this.width, this.height);
    const gap = 14;
    const halfW = (this.width - gap) / 2;
    this.drawCapacityVsSnr(0, halfW);
    ctx.strokeStyle = 'rgba(88,110,117,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfW + gap / 2, 8);
    ctx.lineTo(halfW + gap / 2, this.height - 8);
    ctx.stroke();
    this.drawCapacityVsBandwidth(halfW + gap, halfW);
  }

  private logAxis(lo: number, hi: number) {
    const l0 = Math.log10(lo);
    const l1 = Math.log10(hi);
    return { l0, l1, to: (v: number) => (Math.log10(Math.max(lo, v)) - l0) / (l1 - l0) };
  }

  private drawCapacityVsSnr(ox: number, w: number): void {
    const ctx = this.ctx;
    const padL = 52;
    const padR = 12;
    const padT = 26;
    const padB = 30;
    const pw = w - padL - padR;
    const ph = this.height - padT - padB;
    if (pw < 60) return;

    const cLo = 100;
    const cHi = 1e9;
    const ax = this.logAxis(cLo, cHi);
    const toX = (db: number) => ox + padL + ((db - SNR_MIN_DB) / (SNR_MAX_DB - SNR_MIN_DB)) * pw;
    const toY = (c: number) => padT + ph - ax.to(c) * ph;

    ctx.strokeStyle = 'rgba(88,110,117,0.25)';
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.lineWidth = 1;
    for (let e = 2; e <= 9; e++) {
      const y = toY(Math.pow(10, e));
      ctx.beginPath();
      ctx.moveTo(ox + padL, y);
      ctx.lineTo(ox + padL + pw, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = e >= 9 ? '1G' : e >= 6 ? `${Math.pow(10, e - 6)}M` : e >= 3 ? `${Math.pow(10, e - 3)}k` : '100';
      ctx.fillText(label, ox + padL - 5, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let db = SNR_MIN_DB; db <= SNR_MAX_DB; db += 10) {
      const x = toX(db);
      ctx.strokeStyle = db === 0 ? 'rgba(220,50,47,0.5)' : 'rgba(88,110,117,0.25)';
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ph);
      ctx.stroke();
      ctx.fillStyle = 'rgba(147,161,161,0.7)';
      ctx.fillText(`${db}`, x, padT + ph + 4);
    }

    // the zero-SNR line: everything to its left is below the noise floor
    ctx.fillStyle = 'rgba(220,50,47,0.07)';
    ctx.fillRect(ox + padL, padT, toX(0) - ox - padL, ph);
    ctx.fillStyle = 'rgba(220,50,47,0.8)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('訊號在雜訊底下', ox + padL + 3, padT + 3);

    // capacity curve at the current bandwidth
    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const cols = 200;
    for (let i = 0; i <= cols; i++) {
      const db = SNR_MIN_DB + ((SNR_MAX_DB - SNR_MIN_DB) * i) / cols;
      const c = shannonCapacity(this.bandwidthHz, dbToLinear(db));
      const x = toX(db);
      const y = toY(Math.max(cLo, c));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // real systems
    for (const p of RADIO_PRESETS) {
      const c = shannonCapacity(p.bandwidthHz, dbToLinear(p.snrDb));
      const x = toX(p.snrDb);
      const y = toY(Math.max(cLo, c));
      const here = p.id === this.presetId;
      ctx.fillStyle = here ? '#b58900' : 'rgba(147,161,161,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, here ? 5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      // where the system actually runs
      const ay = toY(Math.max(cLo, p.actualBitrate));
      ctx.strokeStyle = here ? 'rgba(181,137,0,0.7)' : 'rgba(147,161,161,0.3)';
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = here ? '#859900' : 'rgba(147,161,161,0.45)';
      ctx.beginPath();
      ctx.arc(x, ay, here ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // the operating point
    const c = this.capacity();
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.arc(toX(this.snrDb), toY(Math.max(cLo, c)), 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('容量 vs SNR（bit/s，對數）', ox + padL, 4);
    ctx.textAlign = 'right';
    ctx.fillText('SNR (dB) →', ox + padL + pw, 4);
    ctx.textAlign = 'left';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(147,161,161,0.6)';
    ctx.fillText('● 香農上限　● 實際速率', ox + padL, padT + ph + 16);
  }

  private drawCapacityVsBandwidth(ox: number, w: number): void {
    const ctx = this.ctx;
    const padL = 52;
    const padR = 12;
    const padT = 26;
    const padB = 30;
    const pw = w - padL - padR;
    const ph = this.height - padT - padB;
    if (pw < 60) return;

    // hold received power fixed at the current operating point and sweep B
    const noise = noiseFloorDbm(this.bandwidthHz, this.noiseFigureDb);
    const signalMw = dbToLinear(noise + this.snrDb);
    const n0 = dbToLinear(noise) / this.bandwidthHz;
    const cInf = signalMw / (n0 * Math.LN2);

    const bLo = 1e3;
    const bHi = 1e9;
    const axB = this.logAxis(bLo, bHi);
    const cLo = Math.max(10, cInf / 1000);
    const cHi = cInf * 1.6;
    const axC = this.logAxis(cLo, cHi);
    const toX = (b: number) => ox + padL + axB.to(b) * pw;
    const toY = (c: number) => padT + ph - axC.to(Math.max(cLo, c)) * ph;

    ctx.strokeStyle = 'rgba(88,110,117,0.25)';
    ctx.fillStyle = 'rgba(147,161,161,0.7)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let e = 3; e <= 9; e++) {
      const x = toX(Math.pow(10, e));
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ph);
      ctx.stroke();
      ctx.fillText(e >= 9 ? '1G' : e >= 6 ? `${Math.pow(10, e - 6)}M` : `${Math.pow(10, e - 3)}k`, x, padT + ph + 4);
    }

    // the ceiling
    const yInf = toY(cInf);
    ctx.strokeStyle = '#dc322f';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ox + padL, yInf);
    ctx.lineTo(ox + padL + pw, yInf);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#dc322f';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('C∞ = S / (N₀ ln2) — 頻寬無限也過不去', ox + padL + 3, yInf - 3);

    ctx.strokeStyle = '#2aa198';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const cols = 200;
    for (let i = 0; i <= cols; i++) {
      const b = Math.pow(10, Math.log10(bLo) + ((Math.log10(bHi) - Math.log10(bLo)) * i) / cols);
      const snr = signalMw / (n0 * b);
      const c = shannonCapacity(b, snr);
      const x = toX(b);
      const y = toY(c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // where we are on that curve
    const cx = toX(this.bandwidthHz);
    const cy = toY(this.capacity());
    ctx.fillStyle = '#b58900';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253,246,227,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('容量 vs 頻寬（接收功率固定）', ox + padL, 4);
    ctx.textAlign = 'right';
    ctx.fillText('頻寬 (Hz) →', ox + padL + pw, padT + ph + 16);
  }
}
