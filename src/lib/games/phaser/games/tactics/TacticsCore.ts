/**
 * 《推演》核心邏輯（純邏輯，無 Phaser/DOM 依賴）
 *
 * 回合流程：
 *   玩家回合 = 1 次移動（≤ moveRange，正交）+ 1 個行動（攻擊/技能/等待），順序不拘。
 *   兩者用盡或主動結束 → 敵人階段：依鎖定的預告執行（被推位移者中斷）。
 *   攻擊格對其上任何單位造成傷害（含友傷）。解算後重算所有存活敵人的預告。
 *   清空敵人 = 過關（層間二選一獎勵後下一層）；生命歸零 = 死亡。
 */
import { RUN } from './config';
import { ACTIONS, REWARD_POOL, STARTING_ACTIONS } from './data/abilities';
import { ENEMY_DEFS } from './data/enemies';
import { computeIntent } from './systems/intents';
import { generateFloor } from './systems/generator';
import {
    type Board,
    inBounds,
    key,
    manhattan,
    neighbors,
    path,
    posEq,
    ray,
    reachable,
    tileAt,
    unit,
} from './systems/grid';
import { Rng } from './systems/rng';
import type {
    ActionDef,
    ActionId,
    EnemyState,
    GameStatus,
    GridPos,
    PlayerState,
    TacticsSnapshot,
} from './types';

export class TacticsCore {
    private rng: Rng;
    private board!: Board;
    private player!: PlayerState;
    private enemies: EnemyState[] = [];
    private depth = 1;
    private status: GameStatus = 'playing';
    private owned: ActionId[] = [];
    private nextEnemyId = 1;

    moveUsed = false;
    actionUsed = false;
    bestDepth = 0;

    /** 累積本回合的事件訊息（HUD 可取用後清空） */
    log: string[] = [];

    constructor(seed: number = Date.now()) {
        this.rng = new Rng(seed);
    }

    // ── 局面管理 ──
    reset(): void {
        this.depth = 1;
        this.status = 'playing';
        this.owned = [...STARTING_ACTIONS];
        this.spawnFloor();
    }

    private spawnFloor(): void {
        const spec = generateFloor(this.depth, this.rng);
        this.board = spec.board;
        const hp = this.player ? this.player.hp : RUN.playerMaxHp;
        this.player = { pos: { ...spec.playerStart }, hp, maxHp: RUN.playerMaxHp };
        this.enemies = spec.enemies.map((e) => {
            const def = ENEMY_DEFS[e.kind];
            return {
                id: this.nextEnemyId++,
                kind: e.kind,
                pos: { ...e.pos },
                hp: def.hp,
                maxHp: def.hp,
                damage: def.damage,
                moveRange: def.moveRange,
                disrupted: false,
                intent: { moveTo: null, attackTiles: [], damage: def.damage },
            };
        });
        this.recomputeIntents();
        this.moveUsed = false;
        this.actionUsed = false;
        this.status = 'playing';
    }

    getBoard(): Board {
        return this.board;
    }
    getPlayer(): PlayerState {
        return this.player;
    }
    getEnemies(): EnemyState[] {
        return this.enemies;
    }

    private ownedActions(): ActionDef[] {
        return this.owned.map((id) => ACTIONS[id]);
    }

    getState(): TacticsSnapshot {
        return {
            hp: this.player.hp,
            maxHp: this.player.maxHp,
            depth: this.depth,
            enemiesLeft: this.enemies.length,
            status: this.status,
            actions: this.ownedActions(),
            bestDepth: this.bestDepth,
            moveUsed: this.moveUsed,
            actionUsed: this.actionUsed,
        };
    }

    private drainLog(): string[] {
        const out = this.log;
        this.log = [];
        return out;
    }

    // ── 玩家移動 ──
    private blockedByEnemies(): Set<string> {
        return new Set(this.enemies.filter((e) => e.hp > 0).map((e) => key(e.pos)));
    }

    reachableTiles(): GridPos[] {
        if (this.moveUsed || this.status !== 'playing') return [];
        return reachable(this.board, this.player.pos, RUN.playerMoveRange, this.blockedByEnemies());
    }

    canMoveTo(pos: GridPos): boolean {
        return this.reachableTiles().some((p) => posEq(p, pos));
    }

    movePlayer(pos: GridPos): string[] {
        if (!this.canMoveTo(pos)) return [];
        this.player.pos = { ...pos };
        if (tileAt(this.board, pos) === 'spike') {
            this.player.hp -= RUN.spikeDamage;
            this.log.push(`踩到尖刺，−${RUN.spikeDamage}`);
        }
        this.moveUsed = true;
        this.checkPlayerDeath();
        return this.drainLog();
    }

    // ── 玩家行動 ──
    actionTargets(actionId: ActionId): GridPos[] {
        if (this.actionUsed || this.status !== 'playing') return [];
        const def = ACTIONS[actionId];
        const live = this.enemies.filter((e) => e.hp > 0);
        switch (def.targeting) {
            case 'adjacent':
                return neighbors(this.player.pos).filter((n) =>
                    live.some((e) => posEq(e.pos, n)),
                );
            case 'ranged':
                return live
                    .filter((e) => manhattan(e.pos, this.player.pos) <= def.range)
                    .map((e) => ({ ...e.pos }));
            case 'line': {
                // 四方向射線上、含敵人的格子皆可點（點哪格決定方向）
                const dirs: GridPos[] = [
                    { col: 1, row: 0 },
                    { col: -1, row: 0 },
                    { col: 0, row: 1 },
                    { col: 0, row: -1 },
                ];
                const out: GridPos[] = [];
                for (const d of dirs) {
                    const line = ray(this.board, this.player.pos, d, def.range);
                    if (line.some((t) => live.some((e) => posEq(e.pos, t)))) out.push(...line);
                }
                return out;
            }
            case 'all-adjacent':
            case 'self':
                return []; // 無需指定目標，直接施放
        }
    }

    /** all-adjacent / self 類無目標行動可用此判定是否「值得/可」施放 */
    canUseAction(actionId: ActionId): boolean {
        if (this.actionUsed || this.status !== 'playing') return false;
        const def = ACTIONS[actionId];
        if (def.targeting === 'self') return true;
        if (def.targeting === 'all-adjacent') {
            return neighbors(this.player.pos).some((n) =>
                this.enemies.some((e) => e.hp > 0 && posEq(e.pos, n)),
            );
        }
        return this.actionTargets(actionId).length > 0;
    }

    useAction(actionId: ActionId, target?: GridPos): string[] {
        if (this.actionUsed || this.status !== 'playing') return [];
        if (!this.owned.includes(actionId)) return [];
        const def = ACTIONS[actionId];

        switch (def.targeting) {
            case 'self':
                if (def.healing > 0) {
                    const before = this.player.hp;
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.healing);
                    this.log.push(`療傷 +${this.player.hp - before}`);
                }
                break;
            case 'all-adjacent':
                for (const n of neighbors(this.player.pos)) {
                    const e = this.enemyAt(n);
                    if (e) this.hitEnemy(e, def, true);
                }
                break;
            case 'adjacent':
            case 'ranged': {
                if (!target) return [];
                const e = this.enemyAt(target);
                if (!e) return [];
                this.hitEnemy(e, def, false);
                break;
            }
            case 'line': {
                if (!target) return [];
                const dir: GridPos = {
                    col: unit(target.col - this.player.pos.col),
                    row: unit(target.row - this.player.pos.row),
                };
                const line = ray(this.board, this.player.pos, dir, def.range);
                for (const t of line) {
                    const e = this.enemyAt(t);
                    if (e) this.hitEnemy(e, def, false);
                }
                break;
            }
        }

        this.actionUsed = true;
        this.cleanupDead();
        this.checkClear();
        return this.drainLog();
    }

    private enemyAt(pos: GridPos): EnemyState | null {
        return this.enemies.find((e) => e.hp > 0 && posEq(e.pos, pos)) ?? null;
    }

    /** 對敵人施加傷害與推力（push>0 推離玩家、<0 拉近） */
    private hitEnemy(e: EnemyState, def: ActionDef, allAdjacent: boolean): void {
        if (def.damage > 0) e.hp -= def.damage;
        if (def.push !== 0 && e.hp > 0) {
            const away = def.push > 0;
            const ref = this.player.pos;
            const dir: GridPos = away
                ? { col: unit(e.pos.col - ref.col), row: unit(e.pos.row - ref.row) }
                : { col: unit(ref.col - e.pos.col), row: unit(ref.row - e.pos.row) };
            // all-adjacent 時方向已是相鄰，away 正確；單體同理
            this.pushEnemy(e, dir, Math.abs(def.push));
        }
        void allAdjacent;
    }

    /** 推/拉敵人；撞牆/敵人/邊界受撞擊傷並停下、推入深坑即死、經過尖刺受傷。位移會中斷其預告。 */
    private pushEnemy(e: EnemyState, dir: GridPos, distance: number): void {
        if (dir.col === 0 && dir.row === 0) return;
        let moved = false;
        for (let step = 0; step < distance; step++) {
            const next: GridPos = { col: e.pos.col + dir.col, row: e.pos.row + dir.row };
            const t = tileAt(this.board, next);
            const blocked =
                !inBounds(this.board, next) ||
                t === 'wall' ||
                posEq(next, this.player.pos) ||
                this.enemies.some((o) => o.id !== e.id && o.hp > 0 && posEq(o.pos, next));
            if (blocked) {
                e.hp -= RUN.collisionDamage;
                this.log.push(`${ENEMY_DEFS[e.kind].name}撞擊，−${RUN.collisionDamage}`);
                break;
            }
            if (t === 'pit') {
                e.pos = { ...next };
                e.hp = 0;
                this.log.push(`${ENEMY_DEFS[e.kind].name}墜入深坑！`);
                moved = true;
                break;
            }
            e.pos = { ...next };
            moved = true;
            if (t === 'spike') {
                e.hp -= RUN.spikeDamage;
                this.log.push(`${ENEMY_DEFS[e.kind].name}踩刺，−${RUN.spikeDamage}`);
            }
        }
        if (moved) e.disrupted = true;
    }

    // ── 敵人階段 ──
    endTurn(): string[] {
        if (this.status !== 'playing') return [];
        const order = this.enemies.filter((e) => e.hp > 0).sort((a, b) => a.id - b.id);
        for (const e of order) {
            if (e.hp <= 0) continue;
            if (e.disrupted) {
                e.disrupted = false;
                continue; // 被推位移 → 行動中斷
            }
            this.executeEnemy(e);
            if (this.player.hp <= 0) break;
        }
        this.cleanupDead();
        if (this.player.hp <= 0) {
            this.status = 'dead';
            this.updateBest();
            return this.drainLog();
        }
        if (this.enemies.length === 0) {
            this.status = 'cleared';
            this.drainLog();
            return [];
        }
        this.recomputeIntents();
        this.moveUsed = false;
        this.actionUsed = false;
        return this.drainLog();
    }

    private executeEnemy(e: EnemyState): void {
        const intent = e.intent;
        // 移動：朝鎖定目標逼近（其他單位可能已移動，重算路徑）
        if (intent.moveTo) {
            const blocked = new Set<string>(
                this.enemies.filter((o) => o.id !== e.id && o.hp > 0).map((o) => key(o.pos)),
            );
            blocked.add(key(this.player.pos));
            const route = path(this.board, e.pos, intent.moveTo, blocked);
            if (route && route.length >= 2) {
                const maxSteps = Math.min(e.moveRange, route.length - 1);
                // 沿路徑走到「最遠的空格」：path 容許終點被佔，需逐格檢查避免疊在玩家/他敵身上
                let dest = e.pos;
                for (let i = 1; i <= maxSteps; i++) {
                    const t = route[i];
                    if (posEq(t, this.player.pos)) break;
                    if (this.enemies.some((o) => o.id !== e.id && o.hp > 0 && posEq(o.pos, t))) break;
                    dest = t;
                }
                if (!posEq(dest, e.pos)) {
                    e.pos = { ...dest };
                    if (tileAt(this.board, dest) === 'pit') e.hp = 0;
                    else if (tileAt(this.board, dest) === 'spike') e.hp -= RUN.spikeDamage;
                }
            }
        }
        if (e.hp <= 0) return;
        // 攻擊：對鎖定的絕對攻擊格造成傷害（含友傷）
        for (const tile of intent.attackTiles) {
            this.damageTile(tile, intent.damage);
        }
    }

    private damageTile(pos: GridPos, dmg: number): void {
        if (posEq(pos, this.player.pos)) {
            this.player.hp -= dmg;
        }
        for (const e of this.enemies) {
            if (e.hp > 0 && posEq(e.pos, pos)) {
                e.hp -= dmg;
                if (!posEq(pos, this.player.pos)) this.log.push(`友傷！${ENEMY_DEFS[e.kind].name}`);
            }
        }
    }

    private recomputeIntents(): void {
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            e.intent = computeIntent(e, this.board, this.player, this.enemies);
        }
    }

    private cleanupDead(): void {
        this.enemies = this.enemies.filter((e) => e.hp > 0);
    }

    private checkPlayerDeath(): void {
        if (this.player.hp <= 0) {
            this.status = 'dead';
            this.updateBest();
        }
    }

    private checkClear(): void {
        if (this.enemies.length === 0 && this.status === 'playing') {
            this.status = 'cleared';
        }
    }

    private updateBest(): void {
        if (this.depth > this.bestDepth) this.bestDepth = this.depth;
    }

    // ── 層間獎勵 / 下潛 ──
    isCleared(): boolean {
        return this.status === 'cleared';
    }

    /** 提供層間二選一（未持有的技能；若都持有則回補血選項） */
    getRewardOptions(): ActionDef[] {
        const candidates = REWARD_POOL.filter((id) => !this.owned.includes(id));
        const pool = candidates.length >= 2 ? candidates : REWARD_POOL.slice();
        const shuffled = this.rng.shuffle(pool);
        const picks = shuffled.slice(0, 2);
        return picks.map((id) => ACTIONS[id]);
    }

    /** 選定獎勵並下潛到下一層 */
    chooseReward(actionId: ActionId): void {
        if (this.status !== 'cleared') return;
        if (!this.owned.includes(actionId)) this.owned.push(actionId);
        this.depth += 1;
        this.updateBest();
        this.spawnFloor();
    }
}
