import Phaser from 'phaser';
import { GRID, COLORS, BOARD_WIDTH, BOARD_HEIGHT, ECONOMY, STORAGE_KEY, AUTO_NEXT_DELAY_MS } from '../config';
import { LEVEL1 } from '../maps/level1';
import { derivePathCells, toPixelWaypoints, cellKey } from '../systems/path';
import { Economy } from '../systems/Economy';
import { WaveManager } from '../systems/WaveManager';
import { WAVES, TOTAL_WAVES } from '../data/waves';
import { ENEMY_DEFS } from '../data/enemies';
import { TOWER_DEFS, buildCost, totalInvested } from '../data/towers';
import { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import type { ProjectileEffect } from '../entities/Projectile';
import { cellCenter } from '../systems/path';
import type {
    Point,
    TowerType,
    EnemyType,
    GameStatus,
    GameStateSnapshot,
    SelectedTowerInfo,
    TowerDefenseCallbacks,
} from '../types';

/**
 * GameScene：塔防主場景。
 * 負責盤面繪製、敵人/波次更新、經濟與生命、狀態回呼。
 */
export class GameScene extends Phaser.Scene {
    private pathCells!: Set<string>;
    private pixelWaypoints!: Point[];
    private boardGfx!: Phaser.GameObjects.Graphics;

    private economy!: Economy;
    private waveManager!: WaveManager;
    private enemies: Enemy[] = [];
    private towers: Tower[] = [];
    private projectiles: Projectile[] = [];
    private occupied = new Set<string>();

    private placingType: TowerType | null = null;
    private selectedTower: Tower | null = null;
    private rangeGfx!: Phaser.GameObjects.Graphics;
    private ghostGfx!: Phaser.GameObjects.Graphics;

    private callbacks: TowerDefenseCallbacks = {};
    private currentWave = 0; // 已開始的波次數（1-based 顯示）；0 = 尚未開始
    private waveActive = false;
    private status: GameStatus = 'ready';
    private speedMul = 1;
    private paused = false;
    private autoStart = false;
    private bestWave = 0;

    constructor() {
        super({ key: 'GameScene' });
    }

    create(): void {
        this.callbacks = this.game.registry.get('callbacks') ?? {};
        this.pathCells = derivePathCells(LEVEL1.waypoints);
        this.pixelWaypoints = toPixelWaypoints(LEVEL1.waypoints);

        this.economy = new Economy(ECONOMY.startGold, ECONOMY.startLives);
        this.waveManager = new WaveManager();
        this.bestWave = this.loadBestWave();

        this.boardGfx = this.add.graphics();
        this.drawBoard();

        this.rangeGfx = this.add.graphics();
        this.rangeGfx.setDepth(5);
        this.ghostGfx = this.add.graphics();
        this.ghostGfx.setDepth(16);

        this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

        this.emitState();
    }

    update(_time: number, delta: number): void {
        if (this.paused || this.status !== 'playing') return;
        const dtMs = delta * this.speedMul;
        const dtSec = dtMs / 1000;

        // 推進波次 spawn
        this.waveManager.update(dtMs, (type) => this.spawnEnemy(type));

        // 更新敵人
        for (const enemy of this.enemies) enemy.update(dtSec);

        // 塔選目標、開火
        for (const tower of this.towers) {
            tower.update(dtSec, this.enemies, (target, effect) =>
                this.fireProjectile(tower.center, target, tower.def.projectileSpeed, tower.def.projectileColor, effect),
            );
        }

        // 子彈飛行 + 命中解算
        for (const p of this.projectiles) p.update(dtSec);
        this.resolveProjectiles();

        this.resolveEnemies();
        this.checkWaveComplete();
    }

    private fireProjectile(
        from: Point,
        target: Enemy,
        speed: number,
        color: number,
        effect: ProjectileEffect,
    ): void {
        this.projectiles.push(new Projectile(this, from, target, speed, color, effect));
    }

    private resolveProjectiles(): void {
        const survivors: Projectile[] = [];
        for (const p of this.projectiles) {
            if (!p.isDone) {
                survivors.push(p);
                continue;
            }
            this.applyHit(p);
            p.destroy();
        }
        this.projectiles = survivors;
    }

    private applyHit(p: Projectile): void {
        const { damage, splash, slow } = p.effect;
        if (splash > 0) {
            const c = p.impactPoint;
            this.spawnSplashRing(c.x, c.y, splash, COLORS.orange);
            for (const e of this.enemies) {
                if (e.isDead) continue;
                const pos = e.getPosition();
                if (Math.hypot(pos.x - c.x, pos.y - c.y) <= splash) {
                    e.takeDamage(damage);
                    if (slow) e.applySlow(slow.factor, slow.durationMs);
                }
            }
        } else {
            const t = p.targetEnemy;
            if (t && !t.isDead) {
                t.takeDamage(damage);
                if (slow) t.applySlow(slow.factor, slow.durationMs);
            }
        }
    }

    /** 目前波次所在循環（0-based）：每 TOTAL_WAVES 波一圈 */
    private get cycle(): number {
        return Math.max(0, Math.floor((this.currentWave - 1) / TOTAL_WAVES));
    }

    private spawnEnemy(type: EnemyType, startDistance = 0): void {
        const def = ENEMY_DEFS[type];
        const hpMul = Math.pow(1.5, this.cycle);
        const rewardMul = Math.pow(1.25, this.cycle);
        this.enemies.push(new Enemy(this, def, this.pixelWaypoints, startDistance, hpMul, rewardMul));
    }

    /** 處理死亡（給獎勵/分裂）與漏怪（扣生命） */
    private resolveEnemies(): void {
        const survivors: Enemy[] = [];
        let changed = false;
        for (const enemy of this.enemies) {
            if (enemy.isDead) {
                this.economy.earn(enemy.reward);
                const pos = enemy.getPosition();
                this.spawnBurst(pos.x, pos.y, enemy.def.color);
                this.handleSplit(enemy);
                enemy.destroy();
                changed = true;
            } else if (enemy.isLeaked) {
                this.economy.loseLife(enemy.def.leakDamage);
                enemy.destroy();
                changed = true;
            } else {
                survivors.push(enemy);
            }
        }
        if (changed) {
            this.enemies = survivors;
            if (this.economy.isDead) {
                this.gameOver();
                return;
            }
            this.emitState();
        }
    }

    private handleSplit(enemy: Enemy): void {
        const split = enemy.def.splitInto;
        if (!split) return;
        for (let i = 0; i < split.count; i++) {
            // 子代從母體位置稍微錯開出生
            this.spawnEnemy(split.type, Math.max(0, enemy.getDistance() - i * 6));
        }
    }

    private checkWaveComplete(): void {
        if (!this.waveActive) return;
        if (this.waveManager.isSpawning || this.enemies.length > 0) return;

        // 本波清空（無限模式：永遠可進下一波，只有失守才結束）
        this.waveActive = false;
        this.recordBestWave(this.currentWave);
        // 完成一個完整循環時慶祝
        if (this.currentWave % TOTAL_WAVES === 0) {
            this.showCycleBanner(this.currentWave / TOTAL_WAVES);
        }
        this.emitState();
        this.scheduleAutoNext();
    }

    /** 自動進行下一波：間隔後若仍可開波則開 */
    private scheduleAutoNext(): void {
        if (!this.autoStart) return;
        this.time.delayedCall(AUTO_NEXT_DELAY_MS, () => {
            if (this.autoStart && !this.waveActive && this.status !== 'lost') {
                this.startNextWave();
            }
        });
    }

    setAutoStart(on: boolean): void {
        this.autoStart = on;
        if (on && !this.waveActive && this.status !== 'lost') this.scheduleAutoNext();
    }

    // ── 對外控制 API ──
    startNextWave(): void {
        if (this.status === 'ready') this.status = 'playing';
        if (this.status !== 'playing' || this.waveActive) return;
        this.currentWave++;
        // 第 N 波取循環模板：WAVES[(N-1) % 長度]
        this.waveManager.startWave(WAVES[(this.currentWave - 1) % WAVES.length]);
        this.waveActive = true;
        this.showWaveBanner(this.currentWave);
        this.emitState();
    }

    // ── 演出 ──
    private spawnBurst(x: number, y: number, color: number, count = 6): void {
        for (let i = 0; i < count; i++) {
            const dot = this.add.circle(x, y, Phaser.Math.Between(2, 4), color).setDepth(25);
            const ang = Math.random() * Math.PI * 2;
            const dist = Phaser.Math.Between(10, 28);
            this.tweens.add({
                targets: dot,
                x: x + Math.cos(ang) * dist,
                y: y + Math.sin(ang) * dist,
                alpha: 0,
                duration: 300,
                ease: 'Quad.easeOut',
                onComplete: () => dot.destroy(),
            });
        }
    }

    private spawnSplashRing(x: number, y: number, radius: number, color: number): void {
        const ring = this.add.circle(x, y, radius, color, 0).setDepth(24);
        ring.setStrokeStyle(3, color, 0.9);
        ring.setScale(0.2);
        this.tweens.add({
            targets: ring,
            scale: 1,
            alpha: 0,
            duration: 280,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
        });
    }

    private showWaveBanner(n: number): void {
        const txt = this.add
            .text(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, `第 ${n} 波`, {
                fontFamily: 'sans-serif',
                fontSize: '44px',
                color: '#eee8d5',
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(30)
            .setAlpha(0);
        txt.setStroke('#002b36', 6);
        this.tweens.add({
            targets: txt,
            alpha: 1,
            duration: 220,
            yoyo: true,
            hold: 700,
            onComplete: () => txt.destroy(),
        });
    }

    /** 完成一個完整循環的慶祝橫幅 */
    private showCycleBanner(n: number): void {
        const txt = this.add
            .text(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, `✨ 完成第 ${n} 循環`, {
                fontFamily: 'sans-serif',
                fontSize: '40px',
                color: '#b58900',
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(30)
            .setAlpha(0);
        txt.setStroke('#002b36', 6);
        this.tweens.add({
            targets: txt,
            alpha: 1,
            scale: { from: 0.7, to: 1.1 },
            duration: 260,
            yoyo: true,
            hold: 1100,
            onComplete: () => txt.destroy(),
        });
    }

    setSpeed(speed: number): void {
        this.speedMul = speed;
        this.emitState();
    }

    togglePause(): void {
        this.paused = !this.paused;
        this.emitState();
    }

    restartGame(): void {
        for (const e of this.enemies) e.destroy();
        for (const t of this.towers) t.destroy();
        for (const p of this.projectiles) p.destroy();
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.occupied.clear();
        this.deselectTower();
        this.setPlacingType(null);
        this.economy = new Economy(ECONOMY.startGold, ECONOMY.startLives);
        this.waveManager = new WaveManager();
        this.currentWave = 0;
        this.waveActive = false;
        this.status = 'ready';
        this.paused = false;
        this.speedMul = 1;
        this.emitState();
        // 若自動進行已開啟，重開後也自動起跑
        if (this.autoStart) this.scheduleAutoNext();
    }

    selectTowerType(type: TowerType | null): void {
        this.setPlacingType(type);
    }

    /** 建築模式塔種的唯一寫入點，並通知 HUD 同步商店高亮 */
    private setPlacingType(type: TowerType | null): void {
        this.placingType = type;
        if (type) this.deselectTower();
        else this.ghostGfx.clear();
        this.callbacks.onPlacingChanged?.(type);
    }

    upgradeSelectedTower(): void {
        const t = this.selectedTower;
        if (!t || !t.canUpgrade()) return;
        const cost = t.upgradeCost!;
        if (!this.economy.spend(cost)) return;
        t.upgrade();
        this.drawSelectionRange(t);
        this.emitState();
        this.emitSelectedTower(t);
    }

    sellSelectedTower(): void {
        const t = this.selectedTower;
        if (!t) return;
        this.economy.earn(this.sellValue(t));
        this.occupied.delete(cellKey(t.gridPos.col, t.gridPos.row));
        this.towers = this.towers.filter((x) => x !== t);
        t.destroy();
        this.deselectTower();
        this.emitState();
    }

    // ── 輸入：放置 / 選取 ──
    private onPointerMove(p: Phaser.Input.Pointer): void {
        if (!this.placingType) return;
        this.drawGhost(p.x, p.y);
    }

    private onPointerDown(p: Phaser.Input.Pointer): void {
        const col = Math.floor(p.x / GRID.tileSize);
        const row = Math.floor(p.y / GRID.tileSize);

        const tower = this.towers.find((t) => t.gridPos.col === col && t.gridPos.row === row) ?? null;

        if (this.placingType) {
            const key = cellKey(col, row);
            if (this.isBuildable(col, row) && !this.occupied.has(key)) {
                this.tryPlaceTower(this.placingType, col, row);
            } else if (tower) {
                // 點在已建塔 → 退出建築模式並進入該塔的升級模式
                this.selectTower(tower);
            } else {
                // 點在非空地（路徑/場外）→ 取消建築模式
                this.setPlacingType(null);
            }
            return;
        }

        // 非建築模式：選取既有塔，否則取消選取
        if (tower) this.selectTower(tower);
        else this.deselectTower();
    }

    private tryPlaceTower(type: TowerType, col: number, row: number): void {
        const key = cellKey(col, row);
        if (!this.isBuildable(col, row) || this.occupied.has(key)) return;
        const cost = buildCost(type);
        if (!this.economy.spend(cost)) return;

        const tower = new Tower(this, TOWER_DEFS[type], { col, row }, cellCenter({ col, row }));
        this.towers.push(tower);
        this.occupied.add(key);
        this.emitState();
        this.drawGhost(col * GRID.tileSize + GRID.tileSize / 2, row * GRID.tileSize + GRID.tileSize / 2);
    }

    private selectTower(tower: Tower): void {
        if (this.placingType) this.setPlacingType(null);
        this.selectedTower = tower;
        this.drawSelectionRange(tower);
        this.emitSelectedTower(tower);
    }

    private deselectTower(): void {
        this.selectedTower = null;
        this.rangeGfx.clear();
        this.callbacks.onTowerSelected?.(null);
    }

    private sellValue(t: Tower): number {
        return Math.floor(totalInvested(t.def.type, t.level) * ECONOMY.sellRefundRatio);
    }

    private emitSelectedTower(t: Tower): void {
        const info: SelectedTowerInfo = {
            type: t.def.type,
            name: t.def.name,
            level: t.level,
            maxLevel: t.maxLevel,
            damage: t.tier.damage,
            range: t.tier.range,
            upgradeCost: t.upgradeCost,
            sellValue: this.sellValue(t),
        };
        this.callbacks.onTowerSelected?.(info);
    }

    private drawSelectionRange(t: Tower): void {
        const g = this.rangeGfx;
        g.clear();
        g.fillStyle(COLORS.rangeFill, 0.1);
        g.fillCircle(t.center.x, t.center.y, t.tier.range);
        g.lineStyle(1.5, COLORS.rangeFill, 0.5);
        g.strokeCircle(t.center.x, t.center.y, t.tier.range);
    }

    private drawGhost(x: number, y: number): void {
        const ts = GRID.tileSize;
        const col = Math.floor(x / ts);
        const row = Math.floor(y / ts);
        const key = cellKey(col, row);
        const valid =
            this.isBuildable(col, row) &&
            !this.occupied.has(key) &&
            this.placingType !== null &&
            this.economy.canAfford(buildCost(this.placingType));

        const g = this.ghostGfx;
        g.clear();
        const color = valid ? COLORS.green : COLORS.red;
        g.fillStyle(color, 0.25);
        g.fillRect(col * ts + 2, row * ts + 2, ts - 4, ts - 4);
        g.lineStyle(2, color, 0.8);
        g.strokeRect(col * ts + 2, row * ts + 2, ts - 4, ts - 4);

        if (this.placingType) {
            const range = TOWER_DEFS[this.placingType].tiers[0].range;
            const cx = col * ts + ts / 2;
            const cy = row * ts + ts / 2;
            g.fillStyle(color, 0.08);
            g.fillCircle(cx, cy, range);
            g.lineStyle(1, color, 0.4);
            g.strokeCircle(cx, cy, range);
        }
    }

    // ── 狀態 ──
    private gameOver(): void {
        this.status = 'lost';
        this.waveActive = false;
        this.emitState();
    }

    private emitState(): void {
        const snapshot: GameStateSnapshot = {
            gold: this.economy.gold,
            lives: this.economy.lives,
            wave: this.currentWave,
            totalWaves: TOTAL_WAVES,
            cycle: this.cycle,
            waveInProgress: this.waveActive,
            status: this.status,
            speed: this.speedMul,
            bestWave: this.bestWave,
        };
        this.callbacks.onStateChange?.(snapshot);
    }

    private loadBestWave(): number {
        try {
            return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10) || 0;
        } catch {
            return 0;
        }
    }

    private recordBestWave(wave: number): void {
        if (wave <= this.bestWave) return;
        this.bestWave = wave;
        try {
            localStorage.setItem(STORAGE_KEY, String(wave));
        } catch {
            // ignore
        }
    }

    /** 是否為可建格（在盤面內且非路徑） */
    private isBuildable(col: number, row: number): boolean {
        if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return false;
        return !this.pathCells.has(cellKey(col, row));
    }

    private drawBoard(): void {
        const g = this.boardGfx;
        const ts = GRID.tileSize;
        g.clear();

        g.fillStyle(COLORS.background, 1);
        g.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        for (let row = 0; row < GRID.rows; row++) {
            for (let col = 0; col < GRID.cols; col++) {
                const isPath = this.pathCells.has(cellKey(col, row));
                g.fillStyle(isPath ? COLORS.pathTile : COLORS.buildTile, 1);
                g.fillRect(col * ts + 1, row * ts + 1, ts - 2, ts - 2);
            }
        }

        g.lineStyle(1, COLORS.gridLine, 0.5);
        for (let col = 0; col <= GRID.cols; col++) {
            g.lineBetween(col * ts, 0, col * ts, BOARD_HEIGHT);
        }
        for (let row = 0; row <= GRID.rows; row++) {
            g.lineBetween(0, row * ts, BOARD_WIDTH, row * ts);
        }

        g.lineStyle(3, COLORS.cyan, 0.25);
        const pts = this.pixelWaypoints;
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.strokePath();

        const entry = pts[0];
        const exit = pts[pts.length - 1];
        g.fillStyle(COLORS.green, 0.8);
        g.fillCircle(Phaser.Math.Clamp(entry.x, 6, BOARD_WIDTH - 6), entry.y, 6);
        g.fillStyle(COLORS.red, 0.8);
        g.fillCircle(Phaser.Math.Clamp(exit.x, 6, BOARD_WIDTH - 6), exit.y, 6);
    }
}
