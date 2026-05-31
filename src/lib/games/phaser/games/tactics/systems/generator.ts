/**
 * 程序生成競技場：依深度調整敵人數量、敵種組成與陷阱密度。
 * 純函式（吃 Rng），無 Phaser 依賴。
 */
import { GRID } from '../config';
import type { EnemyKind, GridPos, TileType } from '../types';
import type { Board } from './grid';
import { idx, key, manhattan, posEq } from './grid';
import { Rng } from './rng';

export interface FloorSpec {
    board: Board;
    playerStart: GridPos;
    enemies: { kind: EnemyKind; pos: GridPos }[];
}

/** 依深度回傳敵種的加權清單（淺層多衝鋒兵，深層出現弓箭手/重甲） */
function enemyWeights(depth: number): { kind: EnemyKind; w: number }[] {
    return [
        { kind: 'charger', w: 5 },
        { kind: 'archer', w: depth >= 2 ? 2 + Math.floor(depth / 2) : 0 },
        { kind: 'brute', w: depth >= 4 ? 1 + Math.floor(depth / 4) : 0 },
    ].filter((e) => e.w > 0);
}

function pickKind(rng: Rng, depth: number): EnemyKind {
    const weights = enemyWeights(depth);
    const total = weights.reduce((s, e) => s + e.w, 0);
    let roll = rng.next() * total;
    for (const e of weights) {
        roll -= e.w;
        if (roll <= 0) return e.kind;
    }
    return weights[0].kind;
}

function clampScale(base: number, perDepth: number, depth: number, max: number): number {
    return Math.min(base + Math.floor(depth * perDepth), max);
}

export function generateFloor(depth: number, rng: Rng): FloorSpec {
    const { cols, rows } = GRID;
    const tiles: TileType[] = new Array(cols * rows).fill('floor');
    const board: Board = { cols, rows, tiles };

    // 玩家起點：左側兩欄之一
    const playerStart: GridPos = {
        col: rng.int(0, 1),
        row: rng.int(0, rows - 1),
    };

    // 收集候選格（排除玩家起點與其相鄰環，保留玩家活動空間）
    const occupied = new Set<string>([key(playerStart)]);
    const protectedSet = new Set<string>([key(playerStart)]);
    for (const d of [
        { col: 1, row: 0 },
        { col: -1, row: 0 },
        { col: 0, row: 1 },
        { col: 0, row: -1 },
    ]) {
        protectedSet.add(key({ col: playerStart.col + d.col, row: playerStart.row + d.row }));
    }

    const allCells: GridPos[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) allCells.push({ col: c, row: r });
    }
    const freeCells = rng
        .shuffle(allCells)
        .filter((p) => !protectedSet.has(key(p)));

    let cursor = 0;
    const takeCell = (): GridPos | null => {
        while (cursor < freeCells.length) {
            const p = freeCells[cursor++];
            if (!occupied.has(key(p))) return p;
        }
        return null;
    };

    const placeHazard = (type: TileType, count: number) => {
        for (let i = 0; i < count; i++) {
            const p = takeCell();
            if (!p) return;
            tiles[idx(board, p.col, p.row)] = type;
            occupied.add(key(p));
        }
    };

    placeHazard('wall', clampScale(1, 1 / 3, depth, 5));
    placeHazard('pit', clampScale(1, 1 / 3, depth, 4));
    placeHazard('spike', clampScale(2, 1 / 2, depth, 6));

    // 敵人：放在離玩家較遠（曼哈頓 ≥ 3）的地板上
    const enemyCount = clampScale(2, 1 / 2, depth, 6);
    const enemies: { kind: EnemyKind; pos: GridPos }[] = [];
    let guard = 0;
    while (enemies.length < enemyCount && guard < freeCells.length * 2) {
        guard++;
        const p = takeCell();
        if (!p) break;
        if (manhattan(p, playerStart) < 3) continue;
        enemies.push({ kind: pickKind(rng, depth), pos: p });
    }
    // 若因距離限制不足額，放寬距離補滿
    if (enemies.length < Math.min(2, enemyCount)) {
        for (const p of freeCells) {
            if (enemies.length >= enemyCount) break;
            if (occupied.has(key(p))) continue;
            if (enemies.some((e) => posEq(e.pos, p))) continue;
            enemies.push({ kind: pickKind(rng, depth), pos: p });
            occupied.add(key(p));
        }
    }

    return { board, playerStart, enemies };
}
