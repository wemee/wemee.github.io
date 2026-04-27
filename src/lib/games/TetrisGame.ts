import {
  TetrisCore,
  SHAPES,
  type TetrominoType,
  type TetrisAction,
  type TetrisObservation,
  type HardDropEvent,
} from './TetrisCore';

export type ThemeName = 'cyberpunk' | 'aurora' | 'fire';

export interface TetrisGameOptions {
  cols: number;
  rows: number;
  startLevel: number;
  theme: ThemeName;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  age: number;
  duration: number;
  color: string;
  size: number;
}

interface ClearAnimation {
  rows: number[];
  age: number;
  duration: number;
  count: number;
}

type RGB = [number, number, number];

interface ThemeColors {
  bg: [string, string, string];
  grid: string;
  pieceColors: Record<TetrominoType, string>;
  glow: number;
  accent: string;
}

const THEMES: Record<ThemeName, ThemeColors> = {
  cyberpunk: {
    bg: ['#06061a', '#1a0840', '#06061a'],
    grid: 'rgba(120, 220, 255, 0.08)',
    pieceColors: {
      I: '#00f0ff',
      O: '#ffe600',
      T: '#ff3df0',
      S: '#36ff7a',
      Z: '#ff3a6d',
      J: '#3a78ff',
      L: '#ff8a25',
    },
    glow: 1.0,
    accent: '#00f0ff',
  },
  aurora: {
    bg: ['#001423', '#073b54', '#001423'],
    grid: 'rgba(150, 255, 220, 0.08)',
    pieceColors: {
      I: '#7afff0',
      O: '#dcff85',
      T: '#bb95ff',
      S: '#6dffa8',
      Z: '#ff95c5',
      J: '#7da7ff',
      L: '#ffd07a',
    },
    glow: 1.1,
    accent: '#7afff0',
  },
  fire: {
    bg: ['#1a0500', '#3d0a08', '#0d0200'],
    grid: 'rgba(255, 110, 60, 0.1)',
    pieceColors: {
      I: '#fff066',
      O: '#ffaa00',
      T: '#ff5a1f',
      S: '#ff8a00',
      Z: '#ff2a4d',
      J: '#cc1a4d',
      L: '#ff7700',
    },
    glow: 1.4,
    accent: '#ffaa00',
  },
};

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function adjustColor(rgb: RGB, factor: number): RGB {
  if (factor >= 0) {
    return [
      Math.round(rgb[0] + (255 - rgb[0]) * factor),
      Math.round(rgb[1] + (255 - rgb[1]) * factor),
      Math.round(rgb[2] + (255 - rgb[2]) * factor),
    ];
  }
  const f = 1 + factor;
  return [
    Math.round(rgb[0] * f),
    Math.round(rgb[1] * f),
    Math.round(rgb[2] * f),
  ];
}

function rgba(rgb: RGB, a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function rgbStr(rgb: RGB): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

const TYPE_ORDER: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export class TetrisGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private holdCanvas: HTMLCanvasElement;
  private holdCtx: CanvasRenderingContext2D;
  private nextCanvases: HTMLCanvasElement[] = [];
  private nextCtxs: CanvasRenderingContext2D[] = [];

  private core: TetrisCore;
  private theme: ThemeColors;
  private themeName: ThemeName;
  private cellSize: number;
  private boardCols: number;
  private boardRows: number;

  // 渲染狀態
  private particles: Particle[] = [];
  private stars: Array<{ x: number; y: number; size: number; speed: number; phase: number }> = [];
  private floatingTexts: FloatingText[] = [];
  private clearAnim: ClearAnimation | null = null;
  private shake = 0;
  private flash = 0;
  private fadeFlash = 0;
  private timeMs = 0;

  // 遊戲狀態
  private uiState: 'playing' | 'paused' | 'gameover' = 'playing';
  private fallAccum = 0;
  private softLockTimer = 0;
  private softLockMax = 480;
  private softDropHold = false;
  private softDropAccum = 0;
  private dasState: { dir: -1 | 1 | 0; held: number } = { dir: 0, held: 0 };
  private dasDelay = 140;
  private dasInterval = 35;

  private lastFrame = 0;
  private rafId: number | null = null;

  // 回呼
  private onUpdate?: (state: TetrisObservation) => void;
  private onGameOver?: (state: TetrisObservation) => void;

  // 鍵盤事件 binding 引用（destroy 用）
  private keyDownBound: (e: KeyboardEvent) => void;
  private keyUpBound: (e: KeyboardEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    holdCanvas: HTMLCanvasElement,
    nextCanvases: HTMLCanvasElement[],
    options: TetrisGameOptions,
    callbacks?: {
      onUpdate?: (state: TetrisObservation) => void;
      onGameOver?: (state: TetrisObservation) => void;
    },
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.holdCanvas = holdCanvas;
    this.holdCtx = holdCanvas.getContext('2d')!;
    this.nextCanvases = nextCanvases;
    this.nextCtxs = nextCanvases.map((c) => c.getContext('2d')!);

    this.boardCols = options.cols;
    this.boardRows = options.rows;
    this.themeName = options.theme;
    this.theme = THEMES[options.theme];
    this.onUpdate = callbacks?.onUpdate;
    this.onGameOver = callbacks?.onGameOver;

    // 動態決定 cell 大小：以可視高度為基準
    const maxBoardHeight = Math.min(720, window.innerHeight - 200);
    const maxBoardWidth = Math.min(520, window.innerWidth - 320);
    const cellByH = Math.floor(maxBoardHeight / this.boardRows);
    const cellByW = Math.floor(maxBoardWidth / this.boardCols);
    this.cellSize = Math.max(18, Math.min(38, Math.min(cellByH, cellByW)));

    // 設定畫布尺寸（含 DPR）
    const dpr = window.devicePixelRatio || 1;
    const w = this.boardCols * this.cellSize;
    const h = this.boardRows * this.cellSize;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx.scale(dpr, dpr);

    this.setupPreviewCanvas(holdCanvas, this.holdCtx);
    for (let i = 0; i < this.nextCanvases.length; i++) {
      this.setupPreviewCanvas(this.nextCanvases[i], this.nextCtxs[i]);
    }

    this.core = new TetrisCore({
      cols: options.cols,
      rows: options.rows,
      startLevel: options.startLevel,
    });
    this.core.reset();

    this.initStars();

    this.keyDownBound = this.onKeyDown.bind(this);
    this.keyUpBound = this.onKeyUp.bind(this);
    document.addEventListener('keydown', this.keyDownBound);
    document.addEventListener('keyup', this.keyUpBound);

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.gameLoop);
    this.notifyUpdate();
  }

  private setupPreviewCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 100;
    const h = canvas.clientHeight || 100;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
  }

  private initStars() {
    const w = this.boardCols * this.cellSize;
    const h = this.boardRows * this.cellSize;
    const count = Math.floor((w * h) / 4500);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 0.18 + 0.04,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.uiState === 'gameover') return;

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (this.uiState !== 'playing') return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        if (this.dasState.dir !== -1) {
          this.dasState = { dir: -1, held: 0 };
          this.applyAction('left');
        }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        if (this.dasState.dir !== 1) {
          this.dasState = { dir: 1, held: 0 };
          this.applyAction('right');
        }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        this.softDropHold = true;
        this.softDropAccum = 0;
        this.applyAction('softDrop');
        break;
      case 'ArrowUp':
      case 'x':
      case 'X':
        e.preventDefault();
        this.applyAction('rotateCW');
        break;
      case 'z':
      case 'Z':
        e.preventDefault();
        this.applyAction('rotateCCW');
        break;
      case ' ':
        e.preventDefault();
        if (!e.repeat) this.applyAction('hardDrop');
        break;
      case 'c':
      case 'C':
      case 'Shift':
        e.preventDefault();
        this.applyAction('hold');
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (this.dasState.dir === -1) this.dasState = { dir: 0, held: 0 };
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (this.dasState.dir === 1) this.dasState = { dir: 0, held: 0 };
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.softDropHold = false;
        break;
    }
  }

  private togglePause() {
    if (this.uiState === 'playing') {
      this.uiState = 'paused';
    } else if (this.uiState === 'paused') {
      this.uiState = 'playing';
    }
    this.notifyUpdate();
  }

  private applyAction(action: TetrisAction) {
    const result = this.core.step(action);
    const obs = result.observation;

    if (action === 'left' || action === 'right' || action === 'rotateCW' || action === 'rotateCCW') {
      // 嘗試 reset soft lock
      if (!this.core.isGrounded()) {
        this.softLockTimer = 0;
      }
    }

    if (obs.hardDrop) {
      this.spawnHardDropImpact(obs.hardDrop);
      this.shake = Math.max(this.shake, 14);
      this.flash = Math.max(this.flash, 0.45);
    } else if (obs.locked) {
      this.shake = Math.max(this.shake, 3);
      this.spawnLockSparks();
    }

    if (obs.clearCount > 0) {
      this.clearAnim = {
        rows: [...obs.clearedRows],
        age: 0,
        duration: 380,
        count: obs.clearCount,
      };
      this.shake = Math.max(this.shake, 6 + obs.clearCount * 3);
      this.flash = Math.max(this.flash, 0.3 + obs.clearCount * 0.15);
      this.spawnClearParticles(obs.clearedRows);

      const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
      const colors = ['', '#ffffff', '#ffe066', '#ff9a3c', '#ff3df0'];
      const sizes = [0, 22, 28, 34, 44];
      this.floatingTexts.push({
        text: labels[obs.clearCount],
        x: (this.boardCols * this.cellSize) / 2,
        y: (this.boardRows * this.cellSize) / 2 - 20,
        age: 0,
        duration: obs.clearCount === 4 ? 1400 : 900,
        color: colors[obs.clearCount],
        size: sizes[obs.clearCount],
      });
      if (obs.combo > 0) {
        this.floatingTexts.push({
          text: `Combo x${obs.combo + 1}!`,
          x: (this.boardCols * this.cellSize) / 2,
          y: (this.boardRows * this.cellSize) / 2 + 24,
          age: 0,
          duration: 800,
          color: this.theme.accent,
          size: 18,
        });
      }
    }

    if (result.terminated) {
      this.uiState = 'gameover';
      this.shake = 18;
      this.flash = 0.7;
      this.spawnGameOverBurst();
      this.onGameOver?.(obs);
    }

    this.notifyUpdate();
  }

  private notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this.core.getState());
    }
  }

  // === 特效生成 ===
  private spawnHardDropImpact(evt: HardDropEvent) {
    const cs = this.cellSize;
    const color = this.theme.pieceColors[evt.piece];
    const cols = this.boardCols;
    // 找出此 piece 最底部的格子位置
    const shape = evt.shape;
    for (let x = 0; x < shape[0].length; x++) {
      let bottomY = -1;
      for (let y = shape.length - 1; y >= 0; y--) {
        if (shape[y][x]) {
          bottomY = y;
          break;
        }
      }
      if (bottomY < 0) continue;
      const cellGX = evt.x + x;
      const cellGY = evt.landingY + bottomY;
      if (cellGX < 0 || cellGX >= cols) continue;
      const px = cellGX * cs + cs / 2;
      const py = (cellGY + 1) * cs;
      // 每個落點底部噴出火花
      for (let i = 0; i < 12; i++) {
        const angle = -Math.PI + (Math.random() * Math.PI);
        const speed = Math.random() * 5 + 2;
        this.particles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 1,
          maxLife: 1,
          size: Math.random() * 3 + 1.5,
          color,
          gravity: 0.25,
        });
      }
      // 衝擊白光
      for (let i = 0; i < 5; i++) {
        this.particles.push({
          x: px + (Math.random() - 0.5) * cs,
          y: py - Math.random() * 4,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3,
          life: 0.5,
          maxLife: 0.5,
          size: Math.random() * 2 + 1.5,
          color: '#ffffff',
          gravity: 0.1,
        });
      }
    }
  }

  private spawnLockSparks() {
    const state = this.core.getState();
    if (!state.current) return;
    const cs = this.cellSize;
    const color = this.theme.pieceColors[state.current.type];
    const piece = state.current;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[0].length; x++) {
        if (!piece.shape[y][x]) continue;
        const px = (piece.x + x) * cs + cs / 2;
        const py = (piece.y + y) * cs + cs / 2;
        if (Math.random() < 0.4) {
          this.particles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 1.5,
            life: 0.5,
            maxLife: 0.5,
            size: Math.random() * 1.5 + 0.8,
            color,
            gravity: 0.05,
          });
        }
      }
    }
  }

  private spawnClearParticles(rows: number[]) {
    const cs = this.cellSize;
    const w = this.boardCols * cs;
    for (const row of rows) {
      const y = row * cs + cs / 2;
      const numParticles = this.boardCols * 4;
      for (let i = 0; i < numParticles; i++) {
        const x = Math.random() * w;
        const angle = (Math.random() - 0.5) * Math.PI;
        const speed = Math.random() * 6 + 2;
        const colorKeys = TYPE_ORDER;
        const color = this.theme.pieceColors[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          maxLife: 1,
          size: Math.random() * 3 + 1.5,
          color,
          gravity: 0.18,
        });
      }
    }
  }

  private spawnGameOverBurst() {
    const cs = this.cellSize;
    const w = this.boardCols * cs;
    const h = this.boardRows * cs;
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      this.particles.push({
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.5,
        maxLife: 1.5,
        size: Math.random() * 4 + 2,
        color: this.theme.accent,
        gravity: 0.1,
      });
    }
  }

  // === 主迴圈 ===
  private gameLoop = (now: number) => {
    const dt = Math.min(50, now - this.lastFrame);
    this.lastFrame = now;
    this.timeMs += dt;

    if (this.uiState === 'playing') {
      // 重力
      const fallInterval = this.core.getFallInterval();
      if (this.core.isGrounded()) {
        this.softLockTimer += dt;
        this.fallAccum = 0;
        if (this.softLockTimer >= this.softLockMax) {
          this.softLockTimer = 0;
          this.applyAction('tick');
        }
      } else {
        this.softLockTimer = 0;
        this.fallAccum += dt;
        if (this.fallAccum >= fallInterval) {
          this.fallAccum -= fallInterval;
          this.applyAction('tick');
        }
      }

      // 軟降
      if (this.softDropHold) {
        this.softDropAccum += dt;
        if (this.softDropAccum >= 45) {
          this.softDropAccum = 0;
          this.applyAction('softDrop');
        }
      }

      // DAS（左右長按連續移動）
      if (this.dasState.dir !== 0) {
        this.dasState.held += dt;
        if (this.dasState.held > this.dasDelay) {
          this.dasState.held -= this.dasInterval;
          this.applyAction(this.dasState.dir === -1 ? 'left' : 'right');
        }
      }
    }

    this.updateEffects(dt);
    this.render();
    this.renderHold();
    this.renderNext();

    this.rafId = requestAnimationFrame(this.gameLoop);
  };

  private updateEffects(dt: number) {
    // particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.life -= dt / 1000 / p.maxLife;
      return p.life > 0;
    });
    // shake
    if (this.shake > 0) {
      this.shake *= Math.pow(0.85, dt / 16);
      if (this.shake < 0.2) this.shake = 0;
    }
    // flash
    if (this.flash > 0) {
      this.flash -= dt / 250;
      if (this.flash < 0) this.flash = 0;
    }
    // fade flash from clear anim
    if (this.fadeFlash > 0) {
      this.fadeFlash -= dt / 400;
      if (this.fadeFlash < 0) this.fadeFlash = 0;
    }
    // floating text
    this.floatingTexts = this.floatingTexts.filter((t) => {
      t.age += dt;
      t.y -= dt * 0.04;
      return t.age < t.duration;
    });
    // clear animation
    if (this.clearAnim) {
      this.clearAnim.age += dt;
      if (this.clearAnim.age >= this.clearAnim.duration) {
        this.clearAnim = null;
      }
    }
    // 星星
    const h = this.boardRows * this.cellSize;
    for (const s of this.stars) {
      s.y += s.speed * dt * 0.06;
      s.phase += dt * 0.002;
      if (s.y > h) {
        s.y = -2;
        s.x = Math.random() * this.boardCols * this.cellSize;
      }
    }
  }

  // === 主畫布渲染 ===
  private render() {
    const ctx = this.ctx;
    const w = this.boardCols * this.cellSize;
    const h = this.boardRows * this.cellSize;

    ctx.save();

    // 螢幕震動
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    }

    // 背景
    this.drawBackground(ctx, w, h);
    this.drawStars(ctx);
    this.drawGrid(ctx, w, h);

    // 板上方塊
    this.drawBoard(ctx);

    // 幽靈方塊
    this.drawGhost(ctx);

    // 當前方塊
    this.drawCurrentPiece(ctx);

    // 消行動畫
    this.drawClearAnim(ctx, w);

    // 粒子
    this.drawParticles(ctx);

    // 浮動文字
    this.drawFloatingTexts(ctx);

    // 邊框光暈
    this.drawBoardBorder(ctx, w, h);

    ctx.restore();

    // 全螢幕白光（不受震動影響）
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.flash)})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 暫停 / Game Over 遮罩
    if (this.uiState === 'paused') {
      this.drawPauseOverlay(ctx, w, h);
    } else if (this.uiState === 'gameover') {
      this.drawGameOverOverlay(ctx, w, h);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.timeMs * 0.0002;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const [a, b, c] = this.theme.bg;
    grad.addColorStop(0, a);
    grad.addColorStop(0.5 + Math.sin(t) * 0.1, b);
    grad.addColorStop(1, c);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 中心徑向亮點
    const radial = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.6);
    radial.addColorStop(0, rgba(hexToRgb(this.theme.accent), 0.08));
    radial.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, w, h);
  }

  private drawStars(ctx: CanvasRenderingContext2D) {
    const accentRgb = hexToRgb(this.theme.accent);
    for (const s of this.stars) {
      const alpha = 0.3 + Math.sin(s.phase) * 0.25;
      ctx.fillStyle = rgba(accentRgb, Math.max(0, alpha));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = this.theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.boardCols; x++) {
      const px = x * this.cellSize;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = 0; y <= this.boardRows; y++) {
      const py = y * this.cellSize;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
  }

  private drawBoardBorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const accent = hexToRgb(this.theme.accent);
    ctx.save();
    ctx.shadowColor = this.theme.accent;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = rgba(accent, 0.6);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.restore();
  }

  private drawBoard(ctx: CanvasRenderingContext2D) {
    const state = this.core.getState();
    const types = TYPE_ORDER;
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const v = state.board[y][x];
        if (v === 0) continue;
        const type = types[v - 1];
        if (this.clearAnim && this.clearAnim.rows.includes(y)) {
          // 此行正在被消除，由 drawClearAnim 負責
          continue;
        }
        const color = this.theme.pieceColors[type];
        this.drawBlock(ctx, x, y, color, 1);
      }
    }
  }

  private drawCurrentPiece(ctx: CanvasRenderingContext2D) {
    const state = this.core.getState();
    if (!state.current) return;
    const p = state.current;
    const color = this.theme.pieceColors[p.type];
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[0].length; x++) {
        if (!p.shape[y][x]) continue;
        const gx = p.x + x;
        const gy = p.y + y;
        if (gy < 0) continue;
        this.drawBlock(ctx, gx, gy, color, 1, true);
      }
    }
  }

  private drawGhost(ctx: CanvasRenderingContext2D) {
    const state = this.core.getState();
    if (!state.current) return;
    const p = state.current;
    if (p.y === state.ghostY) return;
    const color = this.theme.pieceColors[p.type];
    const rgb = hexToRgb(color);
    ctx.save();
    ctx.strokeStyle = rgba(rgb, 0.55);
    ctx.fillStyle = rgba(rgb, 0.12);
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * this.theme.glow;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[0].length; x++) {
        if (!p.shape[y][x]) continue;
        const gx = p.x + x;
        const gy = state.ghostY + y;
        if (gy < 0) continue;
        const px = gx * this.cellSize;
        const py = gy * this.cellSize;
        ctx.fillRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);
        ctx.strokeRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);
      }
    }
    ctx.restore();
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    color: string,
    alpha: number,
    glowExtra = false,
  ) {
    const cs = this.cellSize;
    const x = gx * cs;
    const y = gy * cs;
    const rgb = hexToRgb(color);
    const lighter = adjustColor(rgb, 0.5);
    const darker = adjustColor(rgb, -0.45);

    ctx.save();
    ctx.globalAlpha = alpha;

    // 外發光
    ctx.shadowColor = color;
    ctx.shadowBlur = (glowExtra ? 22 : 14) * this.theme.glow;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
    ctx.shadowBlur = 0;

    // 漸層填色
    const grad = ctx.createLinearGradient(x, y, x, y + cs);
    grad.addColorStop(0, rgbStr(lighter));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, rgbStr(darker));
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

    // 上緣高光
    const hl = ctx.createLinearGradient(x, y, x, y + cs * 0.4);
    hl.addColorStop(0, 'rgba(255,255,255,0.55)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x + 2, y + 2, cs - 4, cs * 0.35);

    // 下緣陰影
    const sh = ctx.createLinearGradient(x, y + cs * 0.7, x, y + cs);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = sh;
    ctx.fillRect(x + 2, y + cs * 0.7, cs - 4, cs * 0.3);

    // 內框
    ctx.strokeStyle = rgba(lighter, 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3);

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawClearAnim(ctx: CanvasRenderingContext2D, w: number) {
    if (!this.clearAnim) return;
    const t = this.clearAnim.age / this.clearAnim.duration;
    const cs = this.cellSize;
    ctx.save();
    for (const row of this.clearAnim.rows) {
      const y = row * cs;
      // 白光擴散 + 收縮
      const expand = t * cs * 0.6;
      const alpha = Math.max(0, 1 - t);
      const grad = ctx.createLinearGradient(0, y, w, y);
      grad.addColorStop(0, `rgba(255,255,255,0)`);
      grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - expand * 0.2, w, cs + expand * 0.4);

      // 中心強光
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 30;
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
      const halfW = (w / 2) * (1 - t);
      ctx.fillRect(w / 2 - halfW, y + cs * 0.3, halfW * 2, cs * 0.4);
    }
    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.floatingTexts) {
      const p = t.age / t.duration;
      const alpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
      const scale = 0.7 + Math.min(1, p * 4) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 25;
      ctx.fillStyle = t.color;
      ctx.font = `900 ${t.size * scale}px "Inter", "Noto Sans TC", sans-serif`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  private drawPauseOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillText('⏸ 暫停', w / 2, h / 2 - 14);
    ctx.font = '500 14px "Inter", sans-serif';
    ctx.fillText('按 P 繼續', w / 2, h / 2 + 24);
  }

  private drawGameOverOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    const accent = this.theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 25;
    ctx.fillStyle = accent;
    ctx.font = '900 38px "Inter", sans-serif';
    ctx.fillText('GAME OVER', w / 2, h / 2 - 16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 14px "Inter", sans-serif';
    ctx.fillText('按下方按鈕重新開始', w / 2, h / 2 + 24);
  }

  // === Hold / Next 預覽渲染 ===
  private renderHold() {
    const ctx = this.holdCtx;
    const canvas = this.holdCanvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.04)');
    grad.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const state = this.core.getState();
    if (state.hold) {
      this.drawPreviewPiece(ctx, state.hold, w, h, state.canHold ? 1 : 0.4);
    }
  }

  private renderNext() {
    const state = this.core.getState();
    for (let i = 0; i < this.nextCanvases.length; i++) {
      const ctx = this.nextCtxs[i];
      const canvas = this.nextCanvases[i];
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,255,255,0.04)');
      grad.addColorStop(1, 'rgba(255,255,255,0.01)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      if (state.next[i]) {
        this.drawPreviewPiece(ctx, state.next[i], w, h, 1);
      }
    }
  }

  private drawPreviewPiece(
    ctx: CanvasRenderingContext2D,
    type: TetrominoType,
    w: number,
    h: number,
    alpha: number,
  ) {
    const shape = SHAPES[type];
    // 計算 bounding box
    let minX = shape[0].length, maxX = -1, minY = shape.length, maxY = -1;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[0].length; x++) {
        if (shape[y][x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const pw = maxX - minX + 1;
    const ph = maxY - minY + 1;
    const cs = Math.floor(Math.min(w / (pw + 1), h / (ph + 1)));
    const offsetX = (w - pw * cs) / 2 - minX * cs;
    const offsetY = (h - ph * cs) / 2 - minY * cs;
    const color = this.theme.pieceColors[type];
    const rgb = hexToRgb(color);
    const lighter = adjustColor(rgb, 0.5);
    const darker = adjustColor(rgb, -0.45);

    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[0].length; x++) {
        if (!shape[y][x]) continue;
        const px = offsetX + x * cs;
        const py = offsetY + y * cs;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12 * this.theme.glow;
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
        ctx.shadowBlur = 0;
        const grad = ctx.createLinearGradient(px, py, px, py + cs);
        grad.addColorStop(0, rgbStr(lighter));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, rgbStr(darker));
        ctx.fillStyle = grad;
        ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
      }
    }
    ctx.restore();
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    document.removeEventListener('keydown', this.keyDownBound);
    document.removeEventListener('keyup', this.keyUpBound);
  }

  restart() {
    this.core.reset();
    this.particles = [];
    this.floatingTexts = [];
    this.clearAnim = null;
    this.shake = 0;
    this.flash = 0;
    this.softLockTimer = 0;
    this.fallAccum = 0;
    this.uiState = 'playing';
    this.notifyUpdate();
  }
}
