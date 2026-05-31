/**
 * 敵人「預告」計算：在每次解算後、依當前玩家位置鎖定下一步行動。
 * 玩家據此推演，靠走位/推拉讓預告落空或誤傷。
 */
import type { EnemyState, GridPos, Intent, PlayerState } from '../types';
import type { Board } from './grid';
import { inBounds, key, manhattan, neighbors, path, posEq, ray, tileAt, unit } from './grid';

/** 其他單位（敵人）佔據格，作為 pathing 障礙；不含 self 與 player */
function blockedBy(self: EnemyState, enemies: EnemyState[]): Set<string> {
    const s = new Set<string>();
    for (const e of enemies) {
        if (e.id === self.id || e.hp <= 0) continue;
        s.add(key(e.pos));
    }
    return s;
}

/** 沿最短路徑朝 target 逼近，停在 target 相鄰（不踏上 target），最多走 maxSteps 步 */
function approach(
    board: Board,
    from: GridPos,
    target: GridPos,
    maxSteps: number,
    blocked: Set<string>,
): GridPos {
    const route = path(board, from, target, blocked);
    if (!route || route.length < 2) return from;
    // route = [from, ..., adjTarget, target]；不可踏上 target
    const maxIndex = Math.min(maxSteps, route.length - 2);
    return route[maxIndex] ?? from;
}

function emptyIntent(damage: number): Intent {
    return { moveTo: null, attackTiles: [], damage };
}

function chargerIntent(
    self: EnemyState,
    board: Board,
    player: PlayerState,
    enemies: EnemyState[],
): Intent {
    const blocked = blockedBy(self, enemies);
    const dest = approach(board, self.pos, player.pos, self.moveRange, blocked);
    const moveTo = posEq(dest, self.pos) ? null : dest;
    const attackTiles = manhattan(dest, player.pos) === 1 ? [{ ...player.pos }] : [];
    return { moveTo, attackTiles, damage: self.damage };
}

function archerIntent(
    self: EnemyState,
    board: Board,
    player: PlayerState,
    enemies: EnemyState[],
): Intent {
    const sameRow = self.pos.row === player.pos.row;
    const sameCol = self.pos.col === player.pos.col;
    if (sameRow || sameCol) {
        const dir: GridPos = {
            col: sameCol ? 0 : unit(player.pos.col - self.pos.col),
            row: sameRow ? 0 : unit(player.pos.row - self.pos.row),
        };
        const line = ray(board, self.pos, dir, board.cols + board.rows);
        // 確認玩家確實落在這條（未被牆截斷）射線上
        if (line.some((t) => posEq(t, player.pos))) {
            return { moveTo: null, attackTiles: line, damage: self.damage };
        }
    }
    // 未對齊或被遮蔽：移動一格嘗試對齊（不攻擊）
    const blocked = blockedBy(self, enemies);
    const dest = approach(board, self.pos, player.pos, self.moveRange, blocked);
    return { moveTo: posEq(dest, self.pos) ? null : dest, attackTiles: [], damage: self.damage };
}

function bruteIntent(
    self: EnemyState,
    board: Board,
    player: PlayerState,
    enemies: EnemyState[],
): Intent {
    const blocked = blockedBy(self, enemies);
    const dest = approach(board, self.pos, player.pos, self.moveRange, blocked);
    // 對「移動後相鄰四格」橫掃
    const slam = neighbors(dest).filter(
        (t) => inBounds(board, t) && tileAt(board, t) !== 'wall',
    );
    return {
        moveTo: posEq(dest, self.pos) ? null : dest,
        attackTiles: slam,
        damage: self.damage,
    };
}

export function computeIntent(
    self: EnemyState,
    board: Board,
    player: PlayerState,
    enemies: EnemyState[],
): Intent {
    switch (self.kind) {
        case 'charger':
            return chargerIntent(self, board, player, enemies);
        case 'archer':
            return archerIntent(self, board, player, enemies);
        case 'brute':
            return bruteIntent(self, board, player, enemies);
        default:
            return emptyIntent(self.damage);
    }
}
