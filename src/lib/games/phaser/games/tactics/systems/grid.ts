/**
 * 格盤純函式工具：座標、鄰居、BFS 可達/路徑、直線。
 * 不依賴 Phaser，便於單測。
 */
import type { GridPos, TileType } from '../types';

export interface Board {
    cols: number;
    rows: number;
    tiles: TileType[]; // flat，index = row * cols + col
}

export function idx(board: Board, col: number, row: number): number {
    return row * board.cols + col;
}

export function tileAt(board: Board, p: GridPos): TileType {
    if (!inBounds(board, p)) return 'wall';
    return board.tiles[idx(board, p.col, p.row)];
}

export function inBounds(board: Board, p: GridPos): boolean {
    return p.col >= 0 && p.col < board.cols && p.row >= 0 && p.row < board.rows;
}

export function posEq(a: GridPos, b: GridPos): boolean {
    return a.col === b.col && a.row === b.row;
}

export function key(p: GridPos): string {
    return `${p.col},${p.row}`;
}

export function manhattan(a: GridPos, b: GridPos): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/** 正交四鄰 */
const DIRS: readonly GridPos[] = [
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
];

export function neighbors(p: GridPos): GridPos[] {
    return DIRS.map((d) => ({ col: p.col + d.col, row: p.row + d.row }));
}

/** 一格是否「可踏入」（地板或尖刺；牆與坑不可正常踏入），且未被 blocked 集合佔據 */
export function isWalkable(board: Board, p: GridPos, blocked: Set<string>): boolean {
    if (!inBounds(board, p)) return false;
    const t = tileAt(board, p);
    if (t === 'wall' || t === 'pit') return false;
    return !blocked.has(key(p));
}

/**
 * BFS：從 start 出發、步數 ≤ range 可抵達的格子（正交、避開 blocked 與牆/坑）。
 * 不含 start 自身。
 */
export function reachable(
    board: Board,
    start: GridPos,
    range: number,
    blocked: Set<string>,
): GridPos[] {
    const dist = new Map<string, number>([[key(start), 0]]);
    const queue: GridPos[] = [start];
    const out: GridPos[] = [];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        const d = dist.get(key(cur))!;
        if (d >= range) continue;
        for (const nb of neighbors(cur)) {
            if (dist.has(key(nb))) continue;
            if (!isWalkable(board, nb, blocked)) continue;
            dist.set(key(nb), d + 1);
            out.push(nb);
            queue.push(nb);
        }
    }
    return out;
}

/**
 * BFS 最短路徑（含 start、不含或含 goal）。回傳從 start 到 goal 的座標序列；
 * 無路徑回 null。goal 自身可被佔據時仍會嘗試抵達其相鄰再停。
 */
export function path(
    board: Board,
    start: GridPos,
    goal: GridPos,
    blocked: Set<string>,
): GridPos[] | null {
    if (posEq(start, goal)) return [start];
    const prev = new Map<string, GridPos | null>([[key(start), null]]);
    const queue: GridPos[] = [start];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const nb of neighbors(cur)) {
            if (prev.has(key(nb))) continue;
            const isGoal = posEq(nb, goal);
            if (!isGoal && !isWalkable(board, nb, blocked)) continue;
            prev.set(key(nb), cur);
            if (isGoal) {
                const route: GridPos[] = [nb];
                let step: GridPos | null = cur;
                while (step) {
                    route.unshift(step);
                    step = prev.get(key(step)) ?? null;
                }
                return route;
            }
            if (isWalkable(board, nb, blocked)) queue.push(nb);
        }
    }
    return null;
}

/** 單位方向（將 delta 正規成 -1/0/1） */
export function unit(d: number): number {
    return d === 0 ? 0 : d > 0 ? 1 : -1;
}

/**
 * 從 origin 沿方向 dir 射出的直線格子，直到撞牆/出界（不含 origin）。
 * maxLen 限制長度。
 */
export function ray(board: Board, origin: GridPos, dir: GridPos, maxLen: number): GridPos[] {
    const out: GridPos[] = [];
    let cur = { col: origin.col + dir.col, row: origin.row + dir.row };
    for (let i = 0; i < maxLen && inBounds(board, cur); i++) {
        if (tileAt(board, cur) === 'wall') break;
        out.push({ ...cur });
        cur = { col: cur.col + dir.col, row: cur.row + dir.row };
    }
    return out;
}
