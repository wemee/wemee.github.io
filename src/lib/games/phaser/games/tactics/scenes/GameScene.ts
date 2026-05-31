import Phaser from 'phaser';
import { BOARD_HEIGHT, BOARD_WIDTH, COLORS, GRID, STORAGE_KEY } from '../config';
import { ACTIONS } from '../data/abilities';
import { ENEMY_DEFS } from '../data/enemies';
import { posEq } from '../systems/grid';
import { TacticsCore } from '../TacticsCore';
import type { ActionId, GridPos, TacticsCallbacks } from '../types';

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/**
 * GameScene：依 TacticsCore 的狀態繪製整個棋局（每次變動全量重畫，8×6 成本極低），
 * 並處理點選移動 / 行動目標的輸入。HUD 透過 callbacks 與公開方法溝通。
 */
export class GameScene extends Phaser.Scene {
    private core!: TacticsCore;
    private callbacks: TacticsCallbacks = {};
    private gfx!: Phaser.GameObjects.Graphics;
    private labels: Phaser.GameObjects.Text[] = [];
    private pendingAction: ActionId | null = null;

    constructor() {
        super({ key: 'GameScene' });
    }

    create(): void {
        this.callbacks = (this.game.registry.get('callbacks') as TacticsCallbacks) ?? {};
        this.core = new TacticsCore();
        this.core.bestDepth = this.loadBest();
        this.core.reset();

        this.gfx = this.add.graphics();
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

        this.render();
        this.emitState();
    }

    // ── 座標 ──
    private center(p: GridPos): { x: number; y: number } {
        return {
            x: p.col * GRID.tileSize + GRID.tileSize / 2,
            y: p.row * GRID.tileSize + GRID.tileSize / 2,
        };
    }

    // ── 輸入 ──
    private onPointerDown(p: Phaser.Input.Pointer): void {
        if (this.core.getState().status !== 'playing') return;
        const col = Math.floor(p.x / GRID.tileSize);
        const row = Math.floor(p.y / GRID.tileSize);
        if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return;
        const pos: GridPos = { col, row };

        if (this.pendingAction) {
            const targets = this.core.actionTargets(this.pendingAction);
            if (targets.some((t) => posEq(t, pos))) {
                const log = this.core.useAction(this.pendingAction, pos);
                this.pendingAction = null;
                this.afterPlayerInput(log);
            } else {
                this.pendingAction = null; // 點非目標 → 取消行動選取
                this.render();
                this.emitState();
            }
            return;
        }

        if (this.core.canMoveTo(pos)) {
            const log = this.core.movePlayer(pos);
            this.afterPlayerInput(log);
        }
    }

    private afterPlayerInput(log: string[]): void {
        this.emitLog(log);
        this.render();
        this.emitState();
        if (this.core.getState().status === 'dead') {
            this.saveBest();
            return;
        }
        if (this.core.isCleared()) {
            this.saveBest();
            this.offerReward();
            return;
        }
        if (this.core.moveUsed && this.core.actionUsed) this.commitEnemyPhase();
    }

    private commitEnemyPhase(): void {
        const log = this.core.endTurn();
        this.emitLog(log);
        this.render();
        this.emitState();
        if (this.core.getState().status === 'dead') {
            this.saveBest();
            return;
        }
        if (this.core.isCleared()) {
            this.saveBest();
            this.offerReward();
        }
    }

    private offerReward(): void {
        this.callbacks.onRewardOffer?.({ options: this.core.getRewardOptions() });
    }

    // ── 對外（HUD）方法 ──
    /** 選擇行動；回傳是否需要點選目標（self/all-adjacent 會直接施放回 false） */
    selectAction(id: ActionId): boolean {
        if (this.core.getState().status !== 'playing') return false;
        const def = ACTIONS[id];
        if (def.targeting === 'self' || def.targeting === 'all-adjacent') {
            if (!this.core.canUseAction(id)) return false;
            const log = this.core.useAction(id);
            this.pendingAction = null;
            this.afterPlayerInput(log);
            return false;
        }
        if (this.core.actionTargets(id).length === 0) return false;
        this.pendingAction = id;
        this.render();
        return true;
    }

    cancelAction(): void {
        this.pendingAction = null;
        this.render();
        this.emitState();
    }

    /** 等待 / 結束回合（不移動或不行動也可結束） */
    endPlayerTurn(): void {
        this.pendingAction = null;
        this.commitEnemyPhase();
    }

    chooseReward(id: ActionId): void {
        this.core.chooseReward(id);
        this.pendingAction = null;
        this.render();
        this.emitState();
        this.saveBest();
    }

    restartGame(): void {
        this.core.bestDepth = this.loadBest();
        this.core.reset();
        this.pendingAction = null;
        this.render();
        this.emitState();
    }

    // ── 狀態同步 ──
    private emitState(): void {
        this.callbacks.onStateChange?.(this.core.getState());
    }
    private emitLog(log: string[]): void {
        for (const msg of log) this.callbacks.onLog?.(msg);
    }

    private loadBest(): number {
        try {
            return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10) || 0;
        } catch {
            return 0;
        }
    }
    private saveBest(): void {
        try {
            const stored = this.loadBest();
            if (this.core.bestDepth > stored) {
                localStorage.setItem(STORAGE_KEY, String(this.core.bestDepth));
            }
        } catch {
            /* 忽略（無痕模式等） */
        }
    }

    // ── 繪製 ──
    private render(): void {
        this.gfx.clear();
        for (const t of this.labels) t.destroy();
        this.labels = [];

        this.drawTiles();
        const playing = this.core.getState().status === 'playing';
        if (playing && !this.pendingAction) this.drawReachable();
        if (playing && this.pendingAction) this.drawTargets(this.pendingAction);
        this.drawTelegraphs();
        this.drawEntities();
    }

    private drawTiles(): void {
        const ts = GRID.tileSize;
        for (let r = 0; r < GRID.rows; r++) {
            for (let c = 0; c < GRID.cols; c++) {
                const t = this.core.getBoard().tiles[r * GRID.cols + c];
                let fill = (c + r) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
                if (t === 'wall') fill = COLORS.wall;
                else if (t === 'pit') fill = COLORS.pit;
                this.gfx.fillStyle(fill, 1);
                this.gfx.fillRect(c * ts, r * ts, ts, ts);
                if (t === 'spike') {
                    this.gfx.fillStyle(COLORS.spike, 0.85);
                    this.drawSpikeGlyph(c * ts, r * ts, ts);
                }
            }
        }
        // 格線
        this.gfx.lineStyle(1, COLORS.gridLine, 0.5);
        for (let c = 0; c <= GRID.cols; c++) {
            this.gfx.lineBetween(c * ts, 0, c * ts, BOARD_HEIGHT);
        }
        for (let r = 0; r <= GRID.rows; r++) {
            this.gfx.lineBetween(0, r * ts, BOARD_WIDTH, r * ts);
        }
    }

    private drawSpikeGlyph(x: number, y: number, ts: number): void {
        // 三個小三角形示意尖刺
        for (let i = 0; i < 3; i++) {
            const bx = x + ts * (0.25 + i * 0.25);
            const by = y + ts * 0.72;
            this.gfx.fillTriangle(bx - 6, by, bx + 6, by, bx, by - 16);
        }
    }

    private drawReachable(): void {
        const ts = GRID.tileSize;
        this.gfx.fillStyle(COLORS.reachable, 0.28);
        this.gfx.lineStyle(1, COLORS.reachable, 0.6);
        for (const p of this.core.reachableTiles()) {
            this.gfx.fillRect(p.col * ts, p.row * ts, ts, ts);
            this.gfx.strokeRect(p.col * ts + 1, p.row * ts + 1, ts - 2, ts - 2);
        }
    }

    private drawTargets(id: ActionId): void {
        this.gfx.fillStyle(COLORS.targetable, 0.3);
        this.gfx.lineStyle(2, COLORS.targetable, 0.9);
        for (const p of this.core.actionTargets(id)) {
            const x = p.col * GRID.tileSize;
            const y = p.row * GRID.tileSize;
            this.gfx.fillRect(x, y, GRID.tileSize, GRID.tileSize);
            this.gfx.strokeRect(x + 1, y + 1, GRID.tileSize - 2, GRID.tileSize - 2);
        }
    }

    private drawTelegraphs(): void {
        const ts = GRID.tileSize;
        for (const e of this.core.getEnemies()) {
            // 移動預告：目標格黃框
            if (e.intent.moveTo) {
                const m = e.intent.moveTo;
                this.gfx.lineStyle(2, COLORS.telegraphMove, 0.8);
                this.gfx.strokeRect(m.col * ts + 4, m.row * ts + 4, ts - 8, ts - 8);
            }
            // 攻擊預告：紅色實心 + 框
            this.gfx.fillStyle(COLORS.telegraph, 0.32);
            this.gfx.lineStyle(2, COLORS.telegraph, 0.9);
            for (const a of e.intent.attackTiles) {
                this.gfx.fillRect(a.col * ts, a.row * ts, ts, ts);
                this.gfx.strokeRect(a.col * ts + 1, a.row * ts + 1, ts - 2, ts - 2);
            }
        }
    }

    private drawEntities(): void {
        const ts = GRID.tileSize;
        const radius = ts * 0.32;

        // 敵人
        for (const e of this.core.getEnemies()) {
            const def = ENEMY_DEFS[e.kind];
            const { x, y } = this.center(e.pos);
            this.gfx.fillStyle(def.color, 1);
            this.gfx.fillCircle(x, y, radius);
            this.gfx.lineStyle(2, 0x002b36, 1);
            this.gfx.strokeCircle(x, y, radius);
            this.labels.push(
                this.add
                    .text(x, y, def.glyph, {
                        fontFamily: 'monospace',
                        fontSize: `${Math.round(ts * 0.42)}px`,
                        color: '#002b36',
                        fontStyle: 'bold',
                    })
                    .setOrigin(0.5),
            );
            this.drawHpBar(x, y - radius - 8, ts * 0.7, e.hp, e.maxHp, def.color);
        }

        // 玩家
        const { x, y } = this.center(this.core.getPlayer().pos);
        this.gfx.fillStyle(COLORS.player, 1);
        this.gfx.fillCircle(x, y, radius);
        this.gfx.lineStyle(3, COLORS.text, 0.9);
        this.gfx.strokeCircle(x, y, radius);
        this.labels.push(
            this.add
                .text(x, y, '@', {
                    fontFamily: 'monospace',
                    fontSize: `${Math.round(ts * 0.5)}px`,
                    color: '#002b36',
                    fontStyle: 'bold',
                })
                .setOrigin(0.5),
        );
    }

    private drawHpBar(
        cx: number,
        cy: number,
        width: number,
        hp: number,
        maxHp: number,
        color: number,
    ): void {
        const h = 5;
        const x = cx - width / 2;
        this.gfx.fillStyle(0x002b36, 0.85);
        this.gfx.fillRect(x - 1, cy - 1, width + 2, h + 2);
        this.gfx.fillStyle(0x33403f, 1);
        this.gfx.fillRect(x, cy, width, h);
        this.gfx.fillStyle(color, 1);
        this.gfx.fillRect(x, cy, width * Math.max(0, hp / maxHp), h);
    }
}
