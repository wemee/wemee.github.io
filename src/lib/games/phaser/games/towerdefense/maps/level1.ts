/**
 * 關卡一地圖：單一蜿蜒路徑（S 形）
 * 只需定義轉角 waypoints（格座標），路徑格與像素點由 systems/path.ts 推導。
 * 起點 (-1) 與終點 (15) 刻意落在格盤外，讓敵人從畫面外進出。
 */

import type { GridPos } from '../types';

export interface LevelMap {
    name: string;
    waypoints: GridPos[];
}

export const LEVEL1: LevelMap = {
    name: '關卡一・蜿蜒',
    waypoints: [
        { col: -1, row: 1 }, // 場外進場
        { col: 13, row: 1 },
        { col: 13, row: 4 },
        { col: 1, row: 4 },
        { col: 1, row: 7 },
        { col: 15, row: 7 }, // 場外出場
    ],
};
