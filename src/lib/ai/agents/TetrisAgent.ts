/**
 * Tetris AI Agent — 1-ply 啟發式（El-Tetris 風格權重）
 *
 * 不需訓練模型；對每個落點進行純函式模擬，計算 4 個特徵打分，挑最高者執行。
 * 一塊約評估 10×4 = 40 個落點，每個 O(rows × cols)，整體 < 1ms。
 *
 * 權重來源：El-Tetris (Yiyuan Lee, 2013)，公認在 1-ply 中表現極佳的固定權重。
 *   aggregateHeight = -0.510066
 *   completeLines   = +0.760666
 *   holes           = -0.35663
 *   bumpiness       = -0.184483
 */

import { AlgorithmAgent, type PredictionResult } from '../core/Agent';
import {
  SHAPES,
  TYPE_INDEX,
  type TetrisObservation,
  type TetrisAction,
  type TetrominoType,
  type Cell,
} from '@/lib/games/TetrisCore';

const WEIGHTS = {
  aggregateHeight: -0.510066,
  completeLines: 0.760666,
  holes: -0.35663,
  bumpiness: -0.184483,
};

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

function getRotatedShape(type: TetrominoType, rotation: number): number[][] {
  const r = ((rotation % 4) + 4) % 4;
  let s = SHAPES[type].map((row) => [...row]);
  for (let i = 0; i < r; i++) s = rotateMatrixCW(s);
  return s;
}

/** S/Z/I 上下對稱，180° 後等同；O 完全對稱 */
function uniqueRotations(type: TetrominoType): number {
  if (type === 'O') return 1;
  if (type === 'I' || type === 'S' || type === 'Z') return 2;
  return 4;
}

interface SimResult {
  board: Cell[][];
  linesCleared: number;
  topOut: boolean;
}

/**
 * 純函式：把指定 piece 在 (x, rotation) 從上方落下、鎖定、消行，回傳新盤面。
 * 不修改入參。x 越界則回傳 null。
 */
function simulatePlace(
  board: Cell[][],
  type: TetrominoType,
  rotation: number,
  x: number,
  cols: number,
  rows: number,
): SimResult | null {
  const shape = getRotatedShape(type, rotation);

  // x 越界檢查
  for (let py = 0; py < shape.length; py++) {
    for (let px = 0; px < shape[0].length; px++) {
      if (!shape[py][px]) continue;
      const nx = x + px;
      if (nx < 0 || nx >= cols) return null;
    }
  }

  // 從盤面上方往下落，直到再下移一格會碰撞
  let y = -shape.length;
  while (true) {
    let collide = false;
    for (let py = 0; py < shape.length && !collide; py++) {
      for (let px = 0; px < shape[0].length; px++) {
        if (!shape[py][px]) continue;
        const ny = y + py + 1;
        const nx = x + px;
        if (ny >= rows) { collide = true; break; }
        if (ny >= 0 && board[ny][nx]) { collide = true; break; }
      }
    }
    if (collide) break;
    y++;
  }

  // 鎖定到盤面拷貝
  const newBoard = board.map((r) => [...r]);
  let topOut = false;
  for (let py = 0; py < shape.length; py++) {
    for (let px = 0; px < shape[0].length; px++) {
      if (!shape[py][px]) continue;
      const ny = y + py;
      const nx = x + px;
      if (ny < 0) {
        topOut = true;
        continue;
      }
      newBoard[ny][nx] = TYPE_INDEX[type];
    }
  }

  // 消行
  const cleared: number[] = [];
  for (let r = 0; r < rows; r++) {
    if (newBoard[r].every((c) => c !== 0)) cleared.push(r);
  }
  for (let i = cleared.length - 1; i >= 0; i--) newBoard.splice(cleared[i], 1);
  for (let i = 0; i < cleared.length; i++) {
    newBoard.unshift(new Array(cols).fill(0));
  }

  return { board: newBoard, linesCleared: cleared.length, topOut };
}

function computeColumnHeights(board: Cell[][], cols: number, rows: number): number[] {
  const heights = new Array(cols).fill(0);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (board[y][x] !== 0) {
        heights[x] = rows - y;
        break;
      }
    }
  }
  return heights;
}

function countHoles(board: Cell[][], cols: number, rows: number): number {
  let holes = 0;
  for (let x = 0; x < cols; x++) {
    let blockSeen = false;
    for (let y = 0; y < rows; y++) {
      if (board[y][x] !== 0) blockSeen = true;
      else if (blockSeen) holes++;
    }
  }
  return holes;
}

function evaluateBoard(result: SimResult, cols: number, rows: number): number {
  if (result.topOut) return -Infinity;
  const heights = computeColumnHeights(result.board, cols, rows);
  let aggregateHeight = 0;
  let bumpiness = 0;
  for (let i = 0; i < cols; i++) aggregateHeight += heights[i];
  for (let i = 0; i < cols - 1; i++) bumpiness += Math.abs(heights[i] - heights[i + 1]);
  const holes = countHoles(result.board, cols, rows);
  return (
    WEIGHTS.aggregateHeight * aggregateHeight +
    WEIGHTS.completeLines * result.linesCleared +
    WEIGHTS.holes * holes +
    WEIGHTS.bumpiness * bumpiness
  );
}

export interface BestPlacement {
  rotation: number;
  x: number;
  score: number;
}

export class TetrisAgent extends AlgorithmAgent<TetrisObservation, TetrisAction> {
  constructor() {
    super({ cacheKey: 'tetris-ai-heuristic-v1' });
  }

  /**
   * 同步版：每呼叫一次回傳「朝目標落點走的下一個動作」。
   * 因為演算法極快，直接每次重新評估，也避免 wall kick 造成 plan 過時的麻煩。
   */
  step(obs: TetrisObservation): TetrisAction {
    if (obs.gameOver || !obs.current) return 'tick';
    const best = this.findBestPlacement(obs);
    if (!best) return 'hardDrop';

    const cur = obs.current;
    const uniq = uniqueRotations(cur.type);
    const curRotMod = ((cur.rotation % uniq) + uniq) % uniq;

    if (curRotMod !== best.rotation) {
      const delta = (best.rotation - curRotMod + uniq) % uniq;
      // 4-rotation 件中，差 3 步用 CCW 較快；其餘 CW
      if (uniq === 4 && delta === 3) return 'rotateCCW';
      return 'rotateCW';
    }
    if (cur.x < best.x) return 'right';
    if (cur.x > best.x) return 'left';
    return 'hardDrop';
  }

  async predict(obs: TetrisObservation): Promise<PredictionResult<TetrisAction>> {
    return { action: this.step(obs) };
  }

  /**
   * 列舉所有 (rotation, x) 落點，回傳得分最高者。
   */
  findBestPlacement(obs: TetrisObservation): BestPlacement | null {
    if (!obs.current) return null;
    const type = obs.current.type;
    const uniq = uniqueRotations(type);
    let best: BestPlacement | null = null;

    for (let rot = 0; rot < uniq; rot++) {
      const shape = getRotatedShape(type, rot);

      // 找出 shape 裡實際佔據格的 x 範圍，決定合法 x 範圍
      let minPx = shape[0].length;
      let maxPx = -1;
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[0].length; px++) {
          if (shape[py][px]) {
            if (px < minPx) minPx = px;
            if (px > maxPx) maxPx = px;
          }
        }
      }
      const xLo = -minPx;
      const xHi = obs.cols - 1 - maxPx;

      for (let x = xLo; x <= xHi; x++) {
        const result = simulatePlace(obs.board, type, rot, x, obs.cols, obs.rows);
        if (!result) continue;
        const s = evaluateBoard(result, obs.cols, obs.rows);
        if (!best || s > best.score) best = { rotation: rot, x, score: s };
      }
    }
    return best;
  }
}
