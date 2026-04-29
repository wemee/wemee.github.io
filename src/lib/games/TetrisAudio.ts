/**
 * Tetris 音效合成器：使用 Web Audio API 即時合成，無需音檔資源。
 * 第一波只實作 4 個關鍵音效：硬降、消行 (1~3)、Tetris (4)、Game Over。
 *
 * 使用注意：init() 必須在使用者手勢回呼中呼叫（autoplay policy）。
 */

interface ToneOptions {
  type: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  freqRamp?: number;
  attack: number;
  release: number;
  peak: number;
  startT: number;
}

interface NoiseBurstOptions {
  startT: number;
  duration: number;
  peak: number;
  filterStart: number;
  filterEnd: number;
}

export class TetrisAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private readonly masterVolume = 0.35;

  /** 必須在使用者手勢中呼叫，否則 AudioContext 會被瀏覽器阻擋 */
  init(): boolean {
    if (this.ctx) return true;
    const Ctx =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : null;
    if (!Ctx) return false;
    try {
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(
      muted ? 0 : this.masterVolume,
      this.ctx.currentTime,
      0.015,
    );
  }

  isMuted(): boolean {
    return this.muted;
  }

  playHardDrop() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    // 低頻 thump：方波 + 急速降頻，模擬重物落地
    this.tone({
      type: 'square',
      freqStart: 130,
      freqEnd: 38,
      freqRamp: 0.09,
      attack: 0.004,
      release: 0.16,
      peak: 0.55,
      startT: t,
    });
    // Noise burst：lowpass 過濾後的短促敲擊聲
    this.noiseBurst({
      startT: t,
      duration: 0.12,
      peak: 0.4,
      filterStart: 1600,
      filterEnd: 200,
    });
  }

  playLineClear(count: number) {
    if (!this.ready()) return;
    if (count >= 4) {
      this.playTetris();
      return;
    }
    const t = this.ctx!.currentTime;
    // 大三和弦琶音：C5 → E5 → G5（依消行數播 1~3 個音）
    const notes = [523.25, 659.25, 783.99];
    for (let i = 0; i < count; i++) {
      const startT = t + i * 0.055;
      this.tone({
        type: 'sine',
        freqStart: notes[i],
        attack: 0.005,
        release: 0.22,
        peak: 0.32,
        startT,
      });
      // 高八度三角波，增加閃亮感
      this.tone({
        type: 'triangle',
        freqStart: notes[i] * 2,
        attack: 0.005,
        release: 0.18,
        peak: 0.1,
        startT,
      });
    }
  }

  playGameOver() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    // 下行音階：A4 → Ab4 → G4 → F4（鋸齒波傳達低落）
    const notes = [440, 415.3, 392, 349.23];
    for (let i = 0; i < notes.length; i++) {
      this.tone({
        type: 'sawtooth',
        freqStart: notes[i],
        attack: 0.01,
        release: 0.22,
        peak: 0.22,
        startT: t + i * 0.18,
      });
    }
    // 結尾低音 F3，給落幕感
    this.tone({
      type: 'sawtooth',
      freqStart: 174.61,
      attack: 0.015,
      release: 0.7,
      peak: 0.28,
      startT: t + notes.length * 0.18,
    });
  }

  destroy() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
  }

  private playTetris() {
    const t = this.ctx!.currentTime;
    // 大三和弦延展到 C6：C5, E5, G5, C6
    const chord = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < chord.length; i++) {
      const startT = t + i * 0.025;
      this.tone({
        type: 'sine',
        freqStart: chord[i],
        attack: 0.005,
        release: 0.55,
        peak: 0.22,
        startT,
      });
      this.tone({
        type: 'triangle',
        freqStart: chord[i] * 2,
        attack: 0.005,
        release: 0.45,
        peak: 0.07,
        startT,
      });
    }
    // 低頻 boom：地面震動感
    this.tone({
      type: 'sine',
      freqStart: 80,
      freqEnd: 40,
      freqRamp: 0.3,
      attack: 0.008,
      release: 0.4,
      peak: 0.45,
      startT: t,
    });
    // 結尾的高頻 ping：完成感、像鈴聲尾音
    this.tone({
      type: 'sine',
      freqStart: 1568,
      attack: 0.005,
      release: 0.6,
      peak: 0.16,
      startT: t + 0.1,
    });
  }

  private ready(): boolean {
    if (!this.ctx || !this.masterGain) return false;
    if (this.muted) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  private tone(opts: ToneOptions) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freqStart, opts.startT);
    if (opts.freqEnd !== undefined && opts.freqRamp !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(0.0001, opts.freqEnd),
        opts.startT + opts.freqRamp,
      );
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, opts.startT);
    gain.gain.linearRampToValueAtTime(opts.peak, opts.startT + opts.attack);
    gain.gain.exponentialRampToValueAtTime(0.001, opts.startT + opts.attack + opts.release);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(opts.startT);
    osc.stop(opts.startT + opts.attack + opts.release + 0.02);
  }

  private noiseBurst(opts: NoiseBurstOptions) {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.filterStart, opts.startT);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(0.0001, opts.filterEnd),
      opts.startT + opts.duration,
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, opts.startT);
    gain.gain.linearRampToValueAtTime(opts.peak, opts.startT + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, opts.startT + opts.duration);
    noise.connect(filter).connect(gain).connect(this.masterGain!);
    noise.start(opts.startT);
    noise.stop(opts.startT + opts.duration + 0.02);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
