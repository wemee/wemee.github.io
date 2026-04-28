/**
 * Tetris AI Agent — 2-ply 啟發式 + Hold 搜尋（El-Tetris 風格權重）
 *
 * 對「現用塊 + 下一塊」做兩層完整列舉；同時評估「是否使用 Hold」兩種分支。
 * 葉節點以 4 個特徵打分，挑分數最高者執行。
 *
 * 分支量：
 *   1-ply ≈ 40 落點
 *   2-ply ≈ 1,600 落點
 *   2-ply + Hold ≈ 3,200 落點（< 10ms）
 *
 * 權重：El-Tetris (Yiyuan Lee, 2013)。
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

  for (let py = 0; py < shape.length; py++) {
    for (let px = 0; px < shape[0].length; px++) {
      if (!shape[py][px]) continue;
      const nx = x + px;
      if (nx < 0 || nx >= cols) return null;
    }
  }

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

function evaluateBoard(
  board: Cell[][],
  totalLines: number,
  cols: number,
  rows: number,
): number {
  const heights = computeColumnHeights(board, cols, rows);
  let aggregateHeight = 0;
  let bumpiness = 0;
  for (let i = 0; i < cols; i++) aggregateHeight += heights[i];
  for (let i = 0; i < cols - 1; i++) bumpiness += Math.abs(heights[i] - heights[i + 1]);
  const holes = countHoles(board, cols, rows);
  return (
    WEIGHTS.aggregateHeight * aggregateHeight +
    WEIGHTS.completeLines * totalLines +
    WEIGHTS.holes * holes +
    WEIGHTS.bumpiness * bumpiness
  );
}

interface PlacementRange {
  rotation: number;
  xLo: number;
  xHi: number;
}

/** 列出某塊型所有可行的 (rotation, x 範圍) */
function enumeratePlacements(type: TetrominoType, cols: number): PlacementRange[] {
  const ranges: PlacementRange[] = [];
  const uniq = uniqueRotations(type);
  for (let rot = 0; rot < uniq; rot++) {
    const shape = getRotatedShape(type, rot);
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
    ranges.push({ rotation: rot, xLo: -minPx, xHi: cols - 1 - maxPx });
  }
  return ranges;
}

/** 給定盤面和塊型，回傳所有合法落點裡的最高評分（用於 2-ply 葉節點） */
function bestSecondPlyScore(
  board: Cell[][],
  type: TetrominoType,
  prevLines: number,
  cols: number,
  rows: number,
): number {
  let best = -Infinity;
  for (const range of enumeratePlacements(type, cols)) {
    for (let x = range.xLo; x <= range.xHi; x++) {
      const r = simulatePlace(board, type, range.rotation, x, cols, rows);
      if (!r || r.topOut) continue;
      const s = evaluateBoard(r.board, prevLines + r.linesCleared, cols, rows);
      if (s > best) best = s;
    }
  }
  return best;
}

export interface BestPlacement {
  rotation: number;
  x: number;
  score: number;
}

interface SequenceResult {
  placement: BestPlacement;
  score: number;
}

/**
 * 對 firstType 列舉所有落點；若 secondType 存在，再向下展開一層取最大值作為葉節點分數。
 * 回傳第一層的最佳落點（含累計分數）。
 */
function findBestSequence(
  board: Cell[][],
  firstType: TetrominoType,
  secondType: TetrominoType | null,
  cols: number,
  rows: number,
): SequenceResult | null {
  let best: SequenceResult | null = null;

  for (const range of enumeratePlacements(firstType, cols)) {
    for (let x = range.xLo; x <= range.xHi; x++) {
      const sim1 = simulatePlace(board, firstType, range.rotation, x, cols, rows);
      if (!sim1 || sim1.topOut) continue;

      let leafScore: number;
      if (secondType) {
        const second = bestSecondPlyScore(sim1.board, secondType, sim1.linesCleared, cols, rows);
        if (second === -Infinity) continue;
        leafScore = second;
      } else {
        leafScore = evaluateBoard(sim1.board, sim1.linesCleared, cols, rows);
      }

      if (!best || leafScore > best.score) {
        best = {
          placement: { rotation: range.rotation, x, score: leafScore },
          score: leafScore,
        };
      }
    }
  }

  return best;
}

export interface BestPlan {
  useHold: boolean;
  placement: BestPlacement;
}

export class TetrisAgent extends AlgorithmAgent<TetrisObservation, TetrisAction> {
  constructor() {
    super({ cacheKey: 'tetris-ai-2ply-hold-v1' });
  }

  step(obs: TetrisObservation): TetrisAction {
    if (obs.gameOver || !obs.current) return 'tick';
    const plan = this.findBestPlan(obs);
    if (!plan) return 'hardDrop';
    if (plan.useHold) return 'hold';

    const cur = obs.current;
    const uniq = uniqueRotations(cur.type);
    const curRotMod = ((cur.rotation % uniq) + uniq) % uniq;

    if (curRotMod !== plan.placement.rotation) {
      const delta = (plan.placement.rotation - curRotMod + uniq) % uniq;
      if (uniq === 4 && delta === 3) return 'rotateCCW';
      return 'rotateCW';
    }
    if (cur.x < plan.placement.x) return 'right';
    if (cur.x > plan.placement.x) return 'left';
    return 'hardDrop';
  }

  async predict(obs: TetrisObservation): Promise<PredictionResult<TetrisAction>> {
    return { action: this.step(obs) };
  }

  /**
   * 同時評估「不 Hold」與「Hold」兩條路徑的 2-ply 最佳值，回傳較高者。
   * 同分時偏好不 Hold（避免不必要的動作）。
   */
  findBestPlan(obs: TetrisObservation): BestPlan | null {
    if (!obs.current) return null;
    const { cols, rows } = obs;

    // 路徑 A：直接打現用塊；第二層 = next[0]
    const planA = findBestSequence(
      obs.board,
      obs.current.type,
      obs.next[0] ?? null,
      cols,
      rows,
    );

    // 路徑 B：先 Hold，這回合改打交換出來的塊
    let planB: SequenceResult | null = null;
    if (obs.canHold) {
      let playType: TetrominoType | null;
      let secondType: TetrominoType | null;
      if (obs.hold !== null) {
        // 與已暫存的塊交換 → 這回合打 hold；隊列不變，下一塊仍為 next[0]
        playType = obs.hold;
        secondType = obs.next[0] ?? null;
      } else {
        // 暫存槽空 → 暫存現用塊並彈出 next[0] 來打；下一塊變成 next[1]
        playType = obs.next[0] ?? null;
        secondType = obs.next[1] ?? null;
      }
      if (playType) {
        planB = findBestSequence(obs.board, playType, secondType, cols, rows);
      }
    }

    if (!planA && !planB) return null;
    if (!planA) return { useHold: true, placement: planB!.placement };
    if (!planB) return { useHold: false, placement: planA.placement };
    return planB.score > planA.score
      ? { useHold: true, placement: planB.placement }
      : { useHold: false, placement: planA.placement };
  }
}
