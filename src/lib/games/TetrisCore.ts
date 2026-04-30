import {
  GameCore,
  type GameObservation,
  type StepResult,
  type GameCoreConfig,
} from './core/GameCore';

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type TetrisAction =
  | 'left'
  | 'right'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCW'
  | 'rotateCCW'
  | 'hold'
  | 'tick';

export type Cell = number; // 0 empty, 1-7 = piece index

export interface ActivePiece {
  type: TetrominoType;
  rotation: number;
  shape: number[][];
  x: number;
  y: number;
}

export interface HardDropEvent {
  x: number;
  landingY: number;
  piece: TetrominoType;
  shape: number[][];
}

export interface TetrisObservation extends GameObservation {
  board: Cell[][];
  cols: number;
  rows: number;
  current: ActivePiece | null;
  ghostY: number;
  next: TetrominoType[];
  hold: TetrominoType | null;
  canHold: boolean;
  score: number;
  level: number;
  lines: number;
  combo: number;
  gameOver: boolean;
  // event signals (per-step)
  clearedRows: number[];
  clearCount: number;
  perfectClear: boolean;
  hardDrop: HardDropEvent | null;
  locked: boolean;
  isTetris: boolean;
  // 鎖定後、消行前的盤面快照（僅在 clearCount > 0 時提供）
  boardBeforeClear: Cell[][] | null;
}

export interface TetrisConfig extends GameCoreConfig {
  cols?: number;
  rows?: number;
  startLevel?: number;
}

export const TYPE_INDEX: Record<TetrominoType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

export const SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const LEVEL_POINTS_BY_CLEAR_COUNT = [0, 1, 3, 5, 8];

// 簡化版 wall kick：依序嘗試這些位移
const KICK_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [-1, 0], [1, 0],
  [0, -1],
  [-1, -1], [1, -1],
  [-2, 0], [2, 0],
];

function rotateMatrixCW(m: number[][]): number[][] {
  const n = m.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[x][n - 1 - y] = m[y][x];
    }
  }
  return out;
}

function rotateMatrixCCW(m: number[][]): number[][] {
  const n = m.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[n - 1 - x][y] = m[y][x];
    }
  }
  return out;
}

class LCG {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export class TetrisCore extends GameCore<TetrisObservation, TetrisAction> {
  private cols: number;
  private rows: number;
  private startLevel: number;

  private board: Cell[][] = [];
  private current: ActivePiece | null = null;
  private nextQueue: TetrominoType[] = [];
  private hold: TetrominoType | null = null;
  private canHold = true;

  private score = 0;
  private lines = 0;
  private level: number;
  private levelPoints = 0;
  private combo = -1;
  private gameOver = false;

  private rng: LCG;
  private bag: TetrominoType[] = [];

  private evtClearedRows: number[] = [];
  private evtClearCount = 0;
  private evtPerfectClear = false;
  private evtHardDrop: HardDropEvent | null = null;
  private evtLocked = false;
  private evtBoardBeforeClear: Cell[][] | null = null;

  constructor(config: TetrisConfig = {}) {
    super(config);
    this.cols = Math.max(4, Math.min(40, config.cols ?? 10));
    this.rows = Math.max(8, Math.min(40, config.rows ?? 20));
    this.startLevel = Math.max(1, Math.min(20, config.startLevel ?? 1));
    this.level = this.startLevel;
    this.rng = new LCG(config.seed ?? Date.now());
  }

  setSeed(seed: number) {
    this.rng = new LCG(seed);
  }

  reset(): TetrisObservation {
    this.board = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    this.bag = [];
    this.nextQueue = [];
    this.refillQueue();
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = this.startLevel;
    this.levelPoints = 0;
    this.combo = -1;
    this.gameOver = false;
    this.clearEvents();
    this.spawnPiece();
    return this.getState();
  }

  private refillBag() {
    if (this.bag.length === 0) {
      const arr = [...TYPES];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      this.bag = arr;
    }
  }

  private nextType(): TetrominoType {
    this.refillBag();
    return this.bag.pop()!;
  }

  private refillQueue() {
    while (this.nextQueue.length < 5) {
      this.nextQueue.push(this.nextType());
    }
  }

  private spawnPiece(forcedType?: TetrominoType) {
    const type = forcedType ?? this.nextQueue.shift()!;
    this.refillQueue();
    const shape = SHAPES[type].map((r) => [...r]);
    const piece: ActivePiece = {
      type,
      rotation: 0,
      shape,
      x: Math.floor((this.cols - shape[0].length) / 2),
      y: type === 'I' ? -1 : 0,
    };
    if (this.collides(piece, 0, 0, piece.shape)) {
      this.gameOver = true;
    }
    this.current = piece;
  }

  private collides(piece: ActivePiece, dx: number, dy: number, shape: number[][]): boolean {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[0].length; x++) {
        if (!shape[y][x]) continue;
        const nx = piece.x + x + dx;
        const ny = piece.y + y + dy;
        if (nx < 0 || nx >= this.cols) return true;
        if (ny >= this.rows) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private clearEvents() {
    this.evtClearedRows = [];
    this.evtClearCount = 0;
    this.evtPerfectClear = false;
    this.evtHardDrop = null;
    this.evtLocked = false;
    this.evtBoardBeforeClear = null;
  }

  private lockPiece() {
    if (!this.current) return;
    const p = this.current;
    let allAbove = true;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[0].length; x++) {
        if (!p.shape[y][x]) continue;
        const ny = p.y + y;
        const nx = p.x + x;
        if (ny < 0) continue;
        this.board[ny][nx] = TYPE_INDEX[p.type];
        allAbove = false;
      }
    }
    this.evtLocked = true;
    if (allAbove) {
      this.gameOver = true;
    }

    // 找出滿行
    const cleared: number[] = [];
    for (let y = 0; y < this.rows; y++) {
      if (this.board[y].every((c) => c !== 0)) {
        cleared.push(y);
      }
    }

    if (cleared.length > 0) {
      // 快照：鎖定後、消除前的盤面（讓 UI 動畫能呈現「上方方塊往下塌」的物理感）
      this.evtBoardBeforeClear = this.board.map((r) => [...r]);
      // 由下往上移除（保持索引穩定）
      for (let i = cleared.length - 1; i >= 0; i--) {
        this.board.splice(cleared[i], 1);
      }
      for (let i = 0; i < cleared.length; i++) {
        this.board.unshift(new Array(this.cols).fill(0));
      }
      this.evtClearedRows = cleared;
      this.evtClearCount = cleared.length;
      this.lines += cleared.length;
      this.addLevelPoints(cleared.length);
      const lvl = this.getLevel();
      const base = [0, 100, 300, 500, 800][cleared.length] ?? 0;
      this.score += base * lvl;
      if (this.isPerfectClear()) {
        this.evtPerfectClear = true;
        this.score += 4000 * lvl;
      }
      this.combo += 1;
      if (this.combo > 0) {
        this.score += 50 * this.combo * lvl;
      }
    } else {
      this.combo = -1;
    }

    this.canHold = true;
    if (!this.gameOver) {
      this.spawnPiece();
    }
  }

  private getLevel(): number {
    return this.level;
  }

  private getLevelUpThreshold(): number {
    return Math.floor(Math.pow(this.level, 1.5)) * 5;
  }

  private isPerfectClear(): boolean {
    return this.board.every((row) => row.every((cell) => cell === 0));
  }

  private addLevelPoints(clearCount: number) {
    this.levelPoints += LEVEL_POINTS_BY_CLEAR_COUNT[clearCount] ?? 0;
    while (this.levelPoints >= this.getLevelUpThreshold()) {
      this.levelPoints -= this.getLevelUpThreshold();
      this.level += 1;
    }
  }

  private getGhostY(): number {
    if (!this.current) return 0;
    let dy = 0;
    while (!this.collides(this.current, 0, dy + 1, this.current.shape)) {
      dy++;
    }
    return this.current.y + dy;
  }

  private tryRotate(direction: 1 | -1): boolean {
    if (!this.current || this.current.type === 'O') return false;
    const newShape = direction === 1
      ? rotateMatrixCW(this.current.shape)
      : rotateMatrixCCW(this.current.shape);
    for (const [dx, dy] of KICK_OFFSETS) {
      if (!this.collides(this.current, dx, dy, newShape)) {
        this.current.shape = newShape;
        this.current.x += dx;
        this.current.y += dy;
        this.current.rotation = (this.current.rotation + (direction === 1 ? 1 : 3)) % 4;
        return true;
      }
    }
    return false;
  }

  step(action: TetrisAction): StepResult<TetrisObservation> {
    this.clearEvents();
    if (this.gameOver || !this.current) {
      return {
        observation: this.getState(),
        reward: 0,
        terminated: this.gameOver,
        truncated: false,
      };
    }
    const prevScore = this.score;

    switch (action) {
      case 'left':
        if (!this.collides(this.current, -1, 0, this.current.shape)) this.current.x -= 1;
        break;
      case 'right':
        if (!this.collides(this.current, 1, 0, this.current.shape)) this.current.x += 1;
        break;
      case 'softDrop':
        if (!this.collides(this.current, 0, 1, this.current.shape)) {
          this.current.y += 1;
          this.score += 1;
        } else {
          this.lockPiece();
        }
        break;
      case 'hardDrop': {
        const ghostY = this.getGhostY();
        const dropDist = ghostY - this.current.y;
        this.current.y = ghostY;
        this.score += dropDist * 2;
        this.evtHardDrop = {
          x: this.current.x,
          landingY: ghostY,
          piece: this.current.type,
          shape: this.current.shape.map((r) => [...r]),
        };
        this.lockPiece();
        break;
      }
      case 'rotateCW':
        this.tryRotate(1);
        break;
      case 'rotateCCW':
        this.tryRotate(-1);
        break;
      case 'hold': {
        if (!this.canHold) break;
        const cur = this.current.type;
        if (this.hold === null) {
          this.hold = cur;
          this.spawnPiece();
        } else {
          const prev = this.hold;
          this.hold = cur;
          this.spawnPiece(prev);
        }
        this.canHold = false;
        break;
      }
      case 'tick':
        if (!this.collides(this.current, 0, 1, this.current.shape)) {
          this.current.y += 1;
        } else {
          this.lockPiece();
        }
        break;
    }

    return {
      observation: this.getState(),
      reward: this.score - prevScore,
      terminated: this.gameOver,
      truncated: false,
    };
  }

  getState(): TetrisObservation {
    return {
      board: this.board.map((r) => [...r]),
      cols: this.cols,
      rows: this.rows,
      current: this.current
        ? { ...this.current, shape: this.current.shape.map((r) => [...r]) }
        : null,
      ghostY: this.current ? this.getGhostY() : 0,
      next: this.nextQueue.slice(0, 3),
      hold: this.hold,
      canHold: this.canHold,
      score: this.score,
      level: this.getLevel(),
      lines: this.lines,
      combo: Math.max(0, this.combo),
      gameOver: this.gameOver,
      clearedRows: this.evtClearedRows,
      clearCount: this.evtClearCount,
      perfectClear: this.evtPerfectClear,
      hardDrop: this.evtHardDrop,
      locked: this.evtLocked,
      isTetris: this.evtClearCount === 4,
      boardBeforeClear: this.evtBoardBeforeClear
        ? this.evtBoardBeforeClear.map((r) => [...r])
        : null,
    };
  }

  getFallInterval(): number {
    const lvl = this.getLevel();
    return Math.max(80, 800 - (lvl - 1) * 65);
  }

  isGrounded(): boolean {
    if (!this.current) return false;
    return this.collides(this.current, 0, 1, this.current.shape);
  }
}

export const TETROMINO_TYPES = TYPES;
