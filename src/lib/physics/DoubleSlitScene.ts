/**
 * DoubleSlitScene — photons arrive one at a time; the fringes are a statistic.
 *
 * What this scene actually computes: the far-field (Fraunhofer) intensity of
 * a two-slit aperture,
 *
 *     I(y) ∝ sinc²(π a y / λL) · cos²(π d y / λL)
 *
 * and then *samples* photon landing positions from it by inverse-CDF. It does
 * not solve a wave equation, and the page says so — the honesty matters,
 * because the whole point being made is about what a single detection looks
 * like versus what ten thousand of them look like. Faking the fringes by
 * drawing the curve would destroy exactly the claim being demonstrated.
 *
 * With the which-path detector on, the distribution becomes the incoherent sum
 * of two single-slit patterns — the cos² factor is simply gone. Same photons,
 * same slits, no fringes.
 *
 * Accumulated hits live on a fixed-resolution offscreen "photographic plate"
 * so a 50 000-photon run costs one drawImage per frame instead of 50 000 dots.
 */
import { Canvas2DBase, type Canvas2DBaseOptions } from '../math/Canvas2DBase';

/** Slit-to-screen distance, metres. Fixed: it only ever rescales the pattern. */
const SCREEN_DISTANCE = 1;
/** Half-width of the screen, metres (±20 mm). */
const SCREEN_HALF = 0.02;
const BINS = 1400;
const PLATE_W = 1400;
const PLATE_H = 260;
const MAX_RATE = 400;

export interface SlitStats {
  photons: number;
  fringeSpacing: number;
  envelopeFirstZero: number;
  whichPath: boolean;
  streaming: boolean;
  wavelengthNm: number;
  separationMm: number;
  slitWidthMm: number;
}

export interface DoubleSlitSceneOptions extends Canvas2DBaseOptions {
  onStats?: (s: SlitStats) => void;
}

export class DoubleSlitScene extends Canvas2DBase {
  private wavelength = 550e-9;
  private separation = 0.15e-3;
  private slitWidth = 0.03e-3;
  private whichPath = false;
  private streaming = false;
  private rate = 120;

  private photons = 0;
  private readonly counts = new Uint32Array(BINS);
  private readonly pdf = new Float64Array(BINS);
  private readonly cdf = new Float64Array(BINS);
  private peakCount = 1;

  private plate: HTMLCanvasElement;
  private plateCtx: CanvasRenderingContext2D;

  private rafId: number | null = null;
  private rngState = 0x2545f491;
  private readonly onStats?: (s: SlitStats) => void;

  constructor(options: DoubleSlitSceneOptions) {
    super(options);
    this.onStats = options.onStats;

    const plate = document.createElement('canvas');
    plate.width = PLATE_W;
    plate.height = PLATE_H;
    const pctx = plate.getContext('2d');
    if (!pctx) throw new Error('Could not create the double-slit plate context');
    this.plate = plate;
    this.plateCtx = pctx;
    this.clearPlate();

    this.rebuild();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public override destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    super.destroy();
  }

  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ─────────────────────────────────────────── distribution

  /** Normalised intensity at screen position y (metres). */
  private intensity(y: number): number {
    const sinTheta = y / SCREEN_DISTANCE;
    const beta = (Math.PI * this.slitWidth * sinTheta) / this.wavelength;
    const sinc = Math.abs(beta) < 1e-12 ? 1 : Math.sin(beta) / beta;
    const envelope = sinc * sinc;
    if (this.whichPath) return envelope;
    const alpha = (Math.PI * this.separation * sinTheta) / this.wavelength;
    return envelope * Math.cos(alpha) * Math.cos(alpha);
  }

  private rebuild(): void {
    let total = 0;
    for (let i = 0; i < BINS; i++) {
      const y = this.binToY(i + 0.5);
      const v = this.intensity(y);
      this.pdf[i] = v;
      total += v;
    }
    let acc = 0;
    for (let i = 0; i < BINS; i++) {
      acc += this.pdf[i] / total;
      this.cdf[i] = acc;
    }
    this.cdf[BINS - 1] = 1;
    this.resetHits();
  }

  private binToY(bin: number): number {
    return -SCREEN_HALF + (bin / BINS) * (SCREEN_HALF * 2);
  }

  private sampleBin(): number {
    const u = this.random();
    let lo = 0;
    let hi = BINS - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cdf[mid] < u) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // ─────────────────────────────────────────── hits

  private clearPlate(): void {
    this.plateCtx.fillStyle = '#04222b';
    this.plateCtx.fillRect(0, 0, PLATE_W, PLATE_H);
  }

  private resetHits(): void {
    this.photons = 0;
    this.counts.fill(0);
    this.peakCount = 1;
    this.clearPlate();
    this.scheduleRender();
    this.emit();
  }

  public reset(): void {
    this.resetHits();
  }

  public fire(n: number): void {
    const ctx = this.plateCtx;
    ctx.fillStyle = 'rgba(253,246,227,0.85)';
    for (let i = 0; i < n; i++) {
      const bin = this.sampleBin();
      this.counts[bin]++;
      if (this.counts[bin] > this.peakCount) this.peakCount = this.counts[bin];
      const px = ((bin + this.random()) / BINS) * PLATE_W;
      const py = this.random() * PLATE_H;
      ctx.fillRect(px, py, 1.4, 1.4);
    }
    this.photons += n;
    this.scheduleRender();
    this.emit();
  }

  // ─────────────────────────────────────────── controls

  public setWavelengthNm(nm: number): void { this.wavelength = nm * 1e-9; this.rebuild(); }
  public setSeparationMm(mm: number): void { this.separation = mm * 1e-3; this.rebuild(); }
  public setSlitWidthMm(mm: number): void { this.slitWidth = mm * 1e-3; this.rebuild(); }
  public setRate(r: number): void { this.rate = Math.max(1, Math.min(MAX_RATE, r)); }

  public setWhichPath(on: boolean): void {
    this.whichPath = on;
    this.rebuild();
  }

  public toggleStream(): void {
    this.streaming = !this.streaming;
    this.emit();
  }

  private emit(): void {
    this.onStats?.({
      photons: this.photons,
      fringeSpacing: (this.wavelength * SCREEN_DISTANCE) / this.separation,
      envelopeFirstZero: (this.wavelength * SCREEN_DISTANCE) / this.slitWidth,
      whichPath: this.whichPath,
      streaming: this.streaming,
      wavelengthNm: this.wavelength * 1e9,
      separationMm: this.separation * 1e3,
      slitWidthMm: this.slitWidth * 1e3,
    });
  }

  private loop(): void {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.streaming) this.fire(this.rate);
  }

  // ─────────────────────────────────────────── drawing

  protected draw(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = '#04222b';
    ctx.fillRect(0, 0, W, H);

    const schematicH = Math.max(110, H * 0.34);
    const plateH = Math.max(70, H * 0.24);
    const histH = H - schematicH - plateH - 16;

    this.drawSchematic(0, W, schematicH);
    this.drawPlate(schematicH + 8, W, plateH);
    this.drawHistogram(schematicH + plateH + 16, W, histH);
  }

  private drawSchematic(oy: number, w: number, h: number): void {
    const ctx = this.ctx;
    const padX = 24;
    const left = padX;
    const right = w - padX;
    const midY = oy + h / 2;
    const barrierX = left + (right - left) * 0.34;
    const screenX = right;
    const slitGap = Math.max(10, Math.min(34, this.separation * 1e3 * 90));

    // barrier: one vertical bar with two gaps punched out of it
    const barTop = oy + h * 0.1;
    const barBot = oy + h * 0.9;
    const slitA = midY - slitGap / 2;
    const slitB = midY + slitGap / 2;
    const slitH = Math.max(4, Math.min(9, this.slitWidth * 1e3 * 110));
    ctx.fillStyle = 'rgba(88,110,117,0.85)';
    const segments: [number, number][] = [
      [barTop, slitA - slitH / 2],
      [slitA + slitH / 2, slitB - slitH / 2],
      [slitB + slitH / 2, barBot],
    ];
    for (const [y1, y2] of segments) {
      if (y2 > y1) ctx.fillRect(barrierX - 4, y1, 8, y2 - y1);
    }

    // incoming plane wave
    ctx.strokeStyle = 'rgba(38,139,210,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = left + 6 + i * 12;
      ctx.beginPath();
      ctx.moveTo(x, barTop + 6);
      ctx.lineTo(x, barBot - 6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('光源', left + 2, barTop - 12);

    // spreading waves from each slit, clipped to the far side of the barrier
    ctx.save();
    ctx.beginPath();
    ctx.rect(barrierX + 4, oy, screenX - barrierX - 4, h);
    ctx.clip();
    const rings = 11;
    for (const [sy, color] of [[slitA, 'rgba(42,161,152,0.5)'], [slitB, 'rgba(211,54,130,0.5)']] as [number, string][]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let i = 1; i <= rings; i++) {
        const r = (i / rings) * (screenX - barrierX) * 1.15;
        ctx.beginPath();
        ctx.arc(barrierX, sy, r, -Math.PI / 2.2, Math.PI / 2.2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // which-path detectors
    if (this.whichPath) {
      ctx.fillStyle = 'rgba(220,50,47,0.9)';
      for (const sy of [slitA, slitB]) {
        ctx.beginPath();
        ctx.arc(barrierX + 14, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#dc322f';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('偵測器開啟 → 條紋消失', barrierX + 24, barTop - 12);
    }

    // screen
    ctx.strokeStyle = '#fdf6e3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(screenX, barTop);
    ctx.lineTo(screenX, barBot);
    ctx.stroke();
    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('屏幕', screenX - 4, barTop - 12);
  }

  private drawPlate(oy: number, w: number, h: number): void {
    const ctx = this.ctx;
    const padX = 24;
    ctx.drawImage(this.plate, padX, oy, w - padX * 2, h);
    ctx.strokeStyle = 'rgba(88,110,117,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX + 0.5, oy + 0.5, w - padX * 2 - 1, h - 1);
    ctx.fillStyle = 'rgba(147,161,161,0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`底片（屏幕正視）· ${this.photons.toLocaleString('en-US')} 顆光子`, padX + 4, oy + 4);
  }

  private drawHistogram(oy: number, w: number, h: number): void {
    if (h < 30) return;
    const ctx = this.ctx;
    const padX = 24;
    const pw = w - padX * 2;
    const baseY = oy + h - 16;
    const ph = h - 22;

    // measured counts, aggregated to screen columns
    const cols = Math.max(40, Math.floor(pw));
    const perCol = BINS / cols;
    ctx.fillStyle = 'rgba(42,161,152,0.55)';
    let colPeak = 1;
    const colCounts = new Float64Array(cols);
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      const from = Math.floor(c * perCol);
      const to = Math.floor((c + 1) * perCol);
      for (let i = from; i < to; i++) sum += this.counts[i];
      colCounts[c] = sum;
      if (sum > colPeak) colPeak = sum;
    }
    for (let c = 0; c < cols; c++) {
      const barH = (colCounts[c] / colPeak) * ph;
      ctx.fillRect(padX + c, baseY - barH, 1, barH);
    }

    // theory curve on top
    let pdfPeak = 0;
    for (let i = 0; i < BINS; i++) pdfPeak = Math.max(pdfPeak, this.pdf[i]);
    ctx.strokeStyle = '#b58900';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      const i = Math.min(BINS - 1, Math.floor(c * perCol));
      const px = padX + c;
      const py = baseY - (this.pdf[i] / (pdfPeak || 1)) * ph;
      if (c === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88,110,117,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    ctx.lineTo(padX + pw, baseY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(147,161,161,0.75)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let mm = -20; mm <= 20; mm += 5) {
      const px = padX + ((mm / 1000 + SCREEN_HALF) / (SCREEN_HALF * 2)) * pw;
      ctx.fillText(`${mm}`, px, baseY + 3);
    }
    ctx.textAlign = 'right';
    ctx.fillText('屏幕位置 y (mm)', padX + pw, baseY + 3);
  }
}
