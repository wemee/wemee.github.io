/**
 * 路徑工具（純函式，不依賴 Phaser）
 * 由格座標的轉角 waypoints 推導出：路徑格集合、像素 waypoints、總長度。
 */

import { GRID } from '../config';
import type { GridPos, Point } from '../types';

/** 格座標 → 該格中心的像素座標 */
export function cellCenter(pos: GridPos): Point {
    return {
        x: pos.col * GRID.tileSize + GRID.tileSize / 2,
        y: pos.row * GRID.tileSize + GRID.tileSize / 2,
    };
}

/** 產生 "col,row" key 供集合比對 */
export function cellKey(col: number, row: number): string {
    return `${col},${row}`;
}

/**
 * 由轉角 waypoints 填出路徑經過的所有格子（含直線段中間格）。
 * waypoints 必須是水平或垂直相連的轉角。
 */
export function derivePathCells(waypoints: GridPos[]): Set<string> {
    const cells = new Set<string>();
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i];
        const b = waypoints[i + 1];
        const dCol = Math.sign(b.col - a.col);
        const dRow = Math.sign(b.row - a.row);
        let { col, row } = a;
        cells.add(cellKey(col, row));
        while (col !== b.col || row !== b.row) {
            col += dCol;
            row += dRow;
            cells.add(cellKey(col, row));
        }
    }
    return cells;
}

/** 轉角 waypoints → 像素中心點序列（含進場/出場的場外延伸） */
export function toPixelWaypoints(waypoints: GridPos[]): Point[] {
    return waypoints.map(cellCenter);
}

/** 計算像素 waypoints 的總長度 */
export function pathLength(points: Point[]): number {
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) {
        len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }
    return len;
}

/**
 * 給定沿路徑已走的距離 distance，回傳目前像素座標與是否抵達終點。
 * 用於敵人沿路徑移動。
 */
export function positionAtDistance(
    points: Point[],
    distance: number,
): { point: Point; reachedEnd: boolean } {
    if (distance <= 0) return { point: points[0], reachedEnd: false };
    let remaining = distance;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (remaining <= segLen) {
            const t = remaining / segLen;
            return {
                point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
                reachedEnd: false,
            };
        }
        remaining -= segLen;
    }
    return { point: points[points.length - 1], reachedEnd: true };
}
