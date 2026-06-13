import Phaser from 'phaser';
import {
    BOARD_WIDTH,
    BOARD_HEIGHT,
    GROUND_Y,
    LANE_JITTER,
    KEEP_PLAYER_X,
    KEEP_ENEMY_X,
    SPAWN_BEHIND,
    MAX_UNITS_PER_SIDE,
    HOME_RANGE,
    HOME_DAMAGE_BONUS,
    HOME_DEFENSE_BONUS,
    CLERIC_FOLLOW_GAP,
    FOG_X,
    COLORS,
    ECONOMY,
    KEEP_DEFENSE,
    SCOUT_DURATION_MS,
} from '../config';
import { UNIT_DEFS, counterMultiplier } from '../data/units';
import { ABILITY_DEFS, METEOR, RALLY } from '../data/abilities';
import { Economy } from '../systems/Economy';
import { AIController, type AIView } from '../systems/ai';
import { Keep } from '../entities/Keep';
import { Unit } from '../entities/Unit';
import { Projectile } from '../entities/Projectile';
import * as fx from './effects';
import type {
    AbilityType,
    Difficulty,
    GameStateSnapshot,
    GameStatus,
    Point,
    Side,
    UnitType,
    WarfrontCallbacks,
} from '../types';

interface ActiveMeteor {
    x: number;
    y: number;
    ownerSide: Side;
    remMs: number;
}

/**
 * GameScene：《狼煙》主場景。
 * 行軍 / 相剋戰鬥 / 排隊成線、主場優勢、主堡防禦箭、戰爭迷霧、手動指揮技能、勝負判定。
 */
export class GameScene extends Phaser.Scene {
    private callbacks: WarfrontCallbacks = {};

    private units: Unit[] = [];
    private projectiles: Projectile[] = [];
    private meteors: ActiveMeteor[] = [];

    private playerKeep!: Keep;
    private enemyKeep!: Keep;
    private playerEco!: Economy;
    private enemyEco!: Economy;
    private ai!: AIController;

    private status: GameStatus = 'ready';
    private difficulty: Difficulty = 'normal';
    private speedMul = 1;
    private paused = false;

    private armedAbility: AbilityType | null = null;
    private scoutMs = 0;
    private playerRallyMs = 0;
    private enemyRallyMs = 0;
    private playerFireCd = 0;
    private enemyFireCd = 0;
    private emitAccumMs = 0;

    private telegraphGfx!: Phaser.GameObjects.Graphics;
    private fogRect!: Phaser.GameObjects.Rectangle;
    private fogLabel!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'GameScene' });
    }

    create(): void {
        this.callbacks = this.game.registry.get('callbacks') ?? {};

        this.drawBackground();
        this.telegraphGfx = this.add.graphics().setDepth(16);

        this.fogRect = this.add
            .rectangle(FOG_X, 0, BOARD_WIDTH - FOG_X, BOARD_HEIGHT, COLORS.fog, 0.5)
            .setOrigin(0, 0)
            .setDepth(9);
        this.fogLabel = this.add
            .text((FOG_X + BOARD_WIDTH) / 2, 26, '🌫 戰爭迷霧', {
                fontFamily: 'sans-serif',
                fontSize: '15px',
                color: '#7c98a0',
            })
            .setOrigin(0.5)
            .setDepth(9);

        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

        this.setup('normal');
        this.status = 'ready';
        this.emitState();
    }

    // ── 生命週期 ──
    private setup(difficulty: Difficulty): void {
        this.clearEntities();
        this.difficulty = difficulty;
        this.playerEco = new Economy();
        this.enemyEco = new Economy();
        this.ai = new AIController(difficulty);
        this.enemyEco.income = Math.round(this.enemyEco.income * this.ai.incomeMultiplier);

        this.playerKeep = new Keep(this, 'player', KEEP_PLAYER_X, ECONOMY.keepHp);
        this.enemyKeep = new Keep(this, 'enemy', KEEP_ENEMY_X, ECONOMY.keepHp);

        this.speedMul = 1;
        this.paused = false;
        this.armedAbility = null;
        this.scoutMs = 0;
        this.playerRallyMs = 0;
        this.enemyRallyMs = 0;
        this.playerFireCd = 0;
        this.enemyFireCd = 0;
        this.callbacks.onAbilityArmed?.(null);
    }

    private clearEntities(): void {
        for (const u of this.units) u.destroy();
        for (const p of this.projectiles) p.destroy();
        this.units = [];
        this.projectiles = [];
        this.meteors = [];
        this.telegraphGfx?.clear();
        this.playerKeep?.destroy();
        this.enemyKeep?.destroy();
    }

    startMatch(difficulty: Difficulty): void {
        this.setup(difficulty);
        this.status = 'playing';
        fx.banner(this, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, '⚔️ 開戰！', '#eee8d5', 600);
        this.emitState();
    }

    restart(): void {
        this.setup(this.difficulty);
        this.status = 'ready';
        this.emitState();
    }

    // ── 主迴圈 ──
    update(_time: number, delta: number): void {
        if (this.status !== 'playing' || this.paused) return;
        const dtMs = delta * this.speedMul;
        const dtSec = dtMs / 1000;

        this.playerEco.tick(dtSec);
        this.enemyEco.tick(dtSec);
        if (this.playerRallyMs > 0) this.playerRallyMs -= dtMs;
        if (this.enemyRallyMs > 0) this.enemyRallyMs -= dtMs;
        if (this.scoutMs > 0) this.scoutMs -= dtMs;

        this.runAI(dtMs);
        this.updateUnits(dtSec);
        for (const p of this.projectiles) p.update(dtSec);
        this.resolveProjectiles();
        this.updateKeepDefense(dtMs);
        this.updateMeteors(dtMs);
        this.removeDead();

        for (const u of this.units) u.sync(dtMs);
        this.updateFog();
        this.checkEnd();

        this.emitAccumMs += delta;
        if (this.emitAccumMs >= 100) {
            this.emitAccumMs = 0;
            this.emitState();
        }
    }

    // ── 部隊行為 ──
    private updateUnits(dtSec: number): void {
        for (const u of this.units) {
            if (u.isDead) continue;
            if (u.def.kind === 'cleric') {
                this.updateCleric(u, dtSec);
                continue;
            }

            u.cd -= dtSec;
            const foe = this.nearestForwardFoe(u);
            const foeKeep = u.side === 'player' ? this.enemyKeep : this.playerKeep;
            const keepDist = Math.abs(foeKeep.center.x - u.x);
            const range = u.def.range;

            if (foe && foe.dist <= range) {
                if (u.cd <= 0) {
                    this.attackUnit(u, foe.unit);
                    u.cd = u.def.attackCd;
                }
            } else if (!foeKeep.isDestroyed && keepDist <= range) {
                if (u.cd <= 0) {
                    this.attackKeep(u, foeKeep);
                    u.cd = u.def.attackCd;
                }
            } else {
                this.advance(u, dtSec);
            }
        }
    }

    private updateCleric(u: Unit, dtSec: number): void {
        u.cd -= dtSec;
        const dir = u.side === 'player' ? 1 : -1;

        // 找自家最前線的戰鬥單位（非牧師）
        let front: Unit | null = null;
        for (const o of this.units) {
            if (o === u || o.side !== u.side || o.isDead || o.def.kind === 'cleric') continue;
            if (!front || o.x * dir > front.x * dir) front = o;
        }

        // 有友軍 → 跟在前線後方治療；沒友軍 → 退回出生點待命
        const spawnX = u.side === 'player' ? KEEP_PLAYER_X - SPAWN_BEHIND : KEEP_ENEMY_X + SPAWN_BEHIND;
        const desiredX = front ? front.x - dir * CLERIC_FOLLOW_GAP : spawnX;
        const speedMul = u.rallyMs > 0 ? 1 + RALLY.speedBonus : 1;
        const step = u.def.speed * speedMul * dtSec;
        if (Math.abs(desiredX - u.x) <= step) u.x = desiredX;
        else u.x += Math.sign(desiredX - u.x) * step;
        u.x = Phaser.Math.Clamp(u.x, 12, BOARD_WIDTH - 12);

        if (u.cd <= 0) {
            const healed = this.healAround(u);
            u.cd = healed ? u.def.attackCd : 0.3;
        }
    }

    private healAround(u: Unit): boolean {
        const radius = u.def.healRadius ?? 80;
        let healedAny = false;
        for (const other of this.units) {
            if (other.side !== u.side || other.isDead) continue;
            if (other.hp >= other.maxHp) continue;
            if (Math.hypot(other.x - u.x, other.y - u.y) > radius) continue;
            other.heal(u.def.atk);
            fx.healMark(this, other.x, other.y);
            healedAny = true;
        }
        if (healedAny) fx.healPulse(this, u.x, u.y, radius);
        return healedAny;
    }

    private advance(u: Unit, dtSec: number): void {
        // 部隊可自由重疊（不互相阻擋）：只朝敵方主堡方向前進。
        // 前排後排會因射程差異自然形成——近戰擠到最前線、遠程在後方放。
        const dir = u.side === 'player' ? 1 : -1;
        const speedMul = u.rallyMs > 0 ? 1 + RALLY.speedBonus : 1;
        const newX = u.x + dir * u.def.speed * speedMul * dtSec;
        u.x = Phaser.Math.Clamp(newX, 12, BOARD_WIDTH - 12);
    }

    private attackUnit(u: Unit, target: Unit): void {
        const dir = u.side === 'player' ? 1 : -1;
        if (u.def.kind === 'ranged') {
            const dmg = this.damageFromAttacker(u, target.def.type);
            this.fireProjectile(u, { target, kind: 'arrow', speed: 440, damage: dmg, aoeRadius: 0 });
        } else if (u.def.kind === 'mage') {
            const dmg = this.damageFromAttacker(u, null);
            this.fireProjectile(u, {
                target,
                point: target.position,
                kind: 'orb',
                speed: 300,
                damage: dmg,
                aoeRadius: u.def.aoeRadius ?? 50,
            });
        } else {
            const dmg = this.damageFromAttacker(u, target.def.type);
            this.applyDamageToUnit(target, dmg);
            u.lunge();
            fx.slash(this, u.x, u.y, dir, u.def.color);
        }
    }

    private attackKeep(u: Unit, keep: Keep): void {
        const dir = u.side === 'player' ? 1 : -1;
        const dmg = this.damageFromAttacker(u, null);
        if (u.def.kind === 'melee') {
            keep.takeDamage(dmg);
            u.lunge();
            fx.slash(this, u.x, u.y, dir, u.def.color);
            fx.hitSpark(this, keep.x - dir * 30, GROUND_Y - 20, COLORS.white);
        } else {
            this.fireProjectile(u, {
                target: null,
                point: keep.center,
                keep,
                kind: u.def.kind === 'mage' ? 'orb' : 'arrow',
                speed: u.def.kind === 'mage' ? 300 : 440,
                damage: dmg,
                aoeRadius: u.def.kind === 'mage' ? u.def.aoeRadius ?? 50 : 0,
            });
        }
    }

    private fireProjectile(
        u: Unit,
        opts: {
            target: Unit | null;
            point?: Point;
            keep?: Keep;
            kind: 'arrow' | 'orb' | 'bolt';
            speed: number;
            damage: number;
            aoeRadius: number;
        },
    ): void {
        this.projectiles.push(
            new Projectile(this, u.side, { x: u.x, y: u.y - 4 }, { ...opts, color: u.def.color, attackerType: u.def.type }),
        );
    }

    /** 攻擊方輸出（含相剋、主場加成、戰吼加成） */
    private damageFromAttacker(u: Unit, targetType: UnitType | null): number {
        let dmg = u.def.atk;
        if (targetType) dmg *= counterMultiplier(u.def.type, targetType);
        const homeX = u.side === 'player' ? KEEP_PLAYER_X : KEEP_ENEMY_X;
        if (Math.abs(u.x - homeX) <= HOME_RANGE) dmg *= 1 + HOME_DAMAGE_BONUS;
        if (u.rallyMs > 0) dmg *= 1 + RALLY.damageBonus;
        return dmg;
    }

    /** 對守方套用傷害（含主場防禦減免） */
    private applyDamageToUnit(target: Unit, raw: number): void {
        let dmg = raw;
        const homeX = target.side === 'player' ? KEEP_PLAYER_X : KEEP_ENEMY_X;
        if (Math.abs(target.x - homeX) <= HOME_RANGE) dmg *= 1 - HOME_DEFENSE_BONUS;
        target.takeDamage(dmg);
        fx.hitSpark(this, target.x, target.y, COLORS.white);
    }

    private nearestForwardFoe(u: Unit): { unit: Unit; dist: number } | null {
        const dir = u.side === 'player' ? 1 : -1;
        let best: Unit | null = null;
        let bestDist = Infinity;
        for (const o of this.units) {
            if (o.side === u.side || o.isDead) continue;
            if ((o.x - u.x) * dir < -12) continue; // 只看前方
            const d = Math.hypot(o.x - u.x, o.y - u.y);
            if (d < bestDist) {
                bestDist = d;
                best = o;
            }
        }
        return best ? { unit: best, dist: bestDist } : null;
    }

    // ── 投射物命中 ──
    private resolveProjectiles(): void {
        const survivors: Projectile[] = [];
        for (const p of this.projectiles) {
            if (!p.isDone) {
                survivors.push(p);
                continue;
            }
            this.resolveHit(p);
            p.destroy();
        }
        this.projectiles = survivors;
    }

    private resolveHit(p: Projectile): void {
        const impact = p.impactPoint;
        if (p.aoeRadius > 0) {
            fx.aoeRing(this, impact.x, impact.y, p.aoeRadius, COLORS.violet);
            for (const u of this.units) {
                if (u.side === p.side || u.isDead) continue;
                if (Math.hypot(u.x - impact.x, u.y - impact.y) <= p.aoeRadius) {
                    this.applyDamageToUnit(u, p.damage);
                }
            }
            const foeKeep = p.side === 'player' ? this.enemyKeep : this.playerKeep;
            if (Math.hypot(impact.x - foeKeep.center.x, impact.y - foeKeep.center.y) <= p.aoeRadius) {
                foeKeep.takeDamage(p.damage);
            }
        } else {
            fx.hitSpark(this, impact.x, impact.y, COLORS.white);
            if (p.keepTarget) {
                p.keepTarget.takeDamage(p.damage);
            } else {
                const target = p.targetUnit;
                if (target) this.applyDamageToUnit(target, p.damage);
            }
        }
    }

    // ── 主堡防禦箭 ──
    private updateKeepDefense(dtMs: number): void {
        this.playerFireCd -= dtMs;
        this.enemyFireCd -= dtMs;
        if (this.playerFireCd <= 0 && this.tryKeepFire(this.playerKeep, 'player')) {
            this.playerFireCd = KEEP_DEFENSE.cooldownMs;
        }
        if (this.enemyFireCd <= 0 && this.tryKeepFire(this.enemyKeep, 'enemy')) {
            this.enemyFireCd = KEEP_DEFENSE.cooldownMs;
        }
    }

    private tryKeepFire(keep: Keep, side: Side): boolean {
        if (keep.isDestroyed) return false;
        let target: Unit | null = null;
        let bestDist = KEEP_DEFENSE.range;
        for (const u of this.units) {
            if (u.side === side || u.isDead) continue;
            const d = Math.hypot(u.x - keep.center.x, u.y - keep.center.y);
            if (d <= bestDist) {
                bestDist = d;
                target = u;
            }
        }
        if (!target) return false;
        const dmg = KEEP_DEFENSE.baseDamage + keep.level * KEEP_DEFENSE.damagePerLevel;
        this.projectiles.push(
            new Projectile(this, side, keep.center, {
                target,
                kind: 'bolt',
                speed: 540,
                color: side === 'player' ? COLORS.cyan : COLORS.red,
                damage: dmg,
                aoeRadius: 0,
            }),
        );
        return true;
    }

    // ── 隕石 ──
    private updateMeteors(dtMs: number): void {
        this.telegraphGfx.clear();
        const survivors: ActiveMeteor[] = [];
        for (const m of this.meteors) {
            m.remMs -= dtMs;
            if (m.remMs <= 0) {
                this.detonateMeteor(m);
            } else {
                fx.drawTelegraph(this.telegraphGfx, m.x, m.y, METEOR.radius, 1 - m.remMs / METEOR.telegraphMs);
                survivors.push(m);
            }
        }
        this.meteors = survivors;
    }

    private detonateMeteor(m: ActiveMeteor): void {
        fx.meteorImpact(this, m.x, m.y, METEOR.radius);
        const foeSide: Side = m.ownerSide === 'player' ? 'enemy' : 'player';
        for (const u of this.units) {
            if (u.side !== foeSide || u.isDead) continue;
            if (Math.hypot(u.x - m.x, u.y - m.y) <= METEOR.radius) {
                this.applyDamageToUnit(u, METEOR.damage);
            }
        }
        const foeKeep = m.ownerSide === 'player' ? this.enemyKeep : this.playerKeep;
        if (Math.hypot(m.x - foeKeep.center.x, m.y - foeKeep.center.y) <= METEOR.radius) {
            foeKeep.takeDamage(METEOR.damage);
        }
    }

    // ── 死亡 / 賞金 ──
    private removeDead(): void {
        const survivors: Unit[] = [];
        for (const u of this.units) {
            if (u.isDead) {
                fx.deathBurst(this, u.x, u.y, u.def.color);
                const foeEco = u.side === 'player' ? this.enemyEco : this.playerEco;
                foeEco.earn(Math.round(u.def.cost * 0.3));
                u.destroy();
            } else {
                survivors.push(u);
            }
        }
        this.units = survivors;
    }

    // ── 戰爭迷霧 ──
    private updateFog(): void {
        const reveal = this.scoutMs > 0;
        for (const u of this.units) {
            if (u.side === 'enemy') u.setVisible(reveal || u.x <= FOG_X);
        }
        this.fogRect.setAlpha(reveal ? 0.12 : 0.5);
        this.fogLabel.setAlpha(reveal ? 0 : 0.6);
    }

    // ── AI ──
    private runAI(dtMs: number): void {
        const actions = this.ai.tick(dtMs, this.buildAIView());
        for (const a of actions) {
            if (a.kind === 'spawn') this.spawnUnit('enemy', a.unit);
            else if (a.kind === 'income') this.enemyEco.upgradeIncome();
            else if (a.kind === 'keep') this.tryUpgradeKeep('enemy');
            else if (a.kind === 'ability') {
                if (a.ability === 'meteor' && a.point && this.enemyEco.spendCp(ABILITY_DEFS.meteor.cpCost)) {
                    this.castMeteor('enemy', a.point.x, a.point.y);
                } else if (a.ability === 'rally' && this.enemyEco.spendCp(ABILITY_DEFS.rally.cpCost)) {
                    this.castRally('enemy');
                }
            }
        }
    }

    private buildAIView(): AIView {
        const foeCounts: Record<UnitType, number> = { shield: 0, archer: 0, cavalry: 0, mage: 0, cleric: 0 };
        const playerUnits: Unit[] = [];
        let ownCount = 0;
        let pushing = false;
        for (const u of this.units) {
            if (u.isDead) continue;
            if (u.side === 'player') {
                foeCounts[u.def.type]++;
                playerUnits.push(u);
            } else {
                ownCount++;
                if (u.x < BOARD_WIDTH / 2) pushing = true;
            }
        }

        // 玩家最密集處（供隕石瞄準）
        let clusterSize = 0;
        let clusterPoint: Point | null = null;
        for (const c of playerUnits) {
            let n = 0;
            for (const o of playerUnits) {
                if (Math.hypot(o.x - c.x, o.y - c.y) <= METEOR.radius) n++;
            }
            if (n > clusterSize) {
                clusterSize = n;
                clusterPoint = { x: c.x, y: c.y };
            }
        }

        return {
            gold: this.enemyEco.gold,
            cp: this.enemyEco.cp,
            incomeLvl: this.enemyEco.incomeLvl,
            incomeCost: this.enemyEco.incomeCost,
            keepCost: this.enemyEco.keepCost,
            ownUnitCount: ownCount,
            foeUnitCount: playerUnits.length,
            foeCounts,
            ownKeepHpRatio: this.enemyKeep.hp / this.enemyKeep.maxHp,
            foeKeepHpRatio: this.playerKeep.hp / this.playerKeep.maxHp,
            clusterSize,
            clusterPoint,
            pushing,
        };
    }

    // ── 玩家 / 共用動作 ──
    private eco(side: Side): Economy {
        return side === 'player' ? this.playerEco : this.enemyEco;
    }

    private spawnUnit(side: Side, type: UnitType): boolean {
        if (this.status !== 'playing') return false;
        const count = this.units.reduce((n, u) => (u.side === side && !u.isDead ? n + 1 : n), 0);
        if (count >= MAX_UNITS_PER_SIDE) return false;
        const def = UNIT_DEFS[type];
        if (!this.eco(side).spend(def.cost)) return false;

        // 從城堡後方出兵：玩家在主堡左側、敵方在主堡右側
        const x = side === 'player' ? KEEP_PLAYER_X - SPAWN_BEHIND : KEEP_ENEMY_X + SPAWN_BEHIND;
        const y = GROUND_Y + Phaser.Math.Between(-LANE_JITTER, LANE_JITTER);
        const u = new Unit(this, side, def, x, y);
        const sideRally = side === 'player' ? this.playerRallyMs : this.enemyRallyMs;
        if (sideRally > 0) u.rallyMs = sideRally;
        this.units.push(u);
        fx.hitSpark(this, x, y, def.color);
        return true;
    }

    spawnPlayerUnit(type: UnitType): void {
        if (this.spawnUnit('player', type)) this.emitState();
    }

    upgradePlayerIncome(): void {
        if (this.status === 'playing' && this.playerEco.upgradeIncome()) this.emitState();
    }

    upgradePlayerKeep(): void {
        if (this.status === 'playing' && this.tryUpgradeKeep('player')) this.emitState();
    }

    private tryUpgradeKeep(side: Side): boolean {
        const eco = this.eco(side);
        if (!eco.spend(eco.keepCost)) return false;
        eco.keepLvl++;
        (side === 'player' ? this.playerKeep : this.enemyKeep).upgrade(ECONOMY.keepHpStep);
        return true;
    }

    // ── 技能 ──
    useAbility(type: AbilityType): void {
        if (this.status !== 'playing') return;
        const def = ABILITY_DEFS[type];
        if (def.targeted) {
            // 切換武裝狀態，等待點選落點
            this.armedAbility = this.armedAbility === type ? null : type;
            this.callbacks.onAbilityArmed?.(this.armedAbility);
            return;
        }
        if (!this.playerEco.spendCp(def.cpCost)) return;
        if (type === 'rally') this.castRally('player');
        else if (type === 'scout') {
            this.scoutMs = SCOUT_DURATION_MS;
            fx.banner(this, BOARD_WIDTH / 2, 60, '🔭 偵查！', '#2aa198', 500, 26);
        }
        this.emitState();
    }

    cancelAbility(): void {
        if (this.armedAbility) {
            this.armedAbility = null;
            this.callbacks.onAbilityArmed?.(null);
        }
    }

    private onPointerDown(p: Phaser.Input.Pointer): void {
        if (this.armedAbility !== 'meteor' || this.status !== 'playing') return;
        if (this.playerEco.spendCp(ABILITY_DEFS.meteor.cpCost)) {
            this.castMeteor('player', p.worldX, Phaser.Math.Clamp(p.worldY, GROUND_Y - 40, GROUND_Y + 20));
        }
        this.armedAbility = null;
        this.callbacks.onAbilityArmed?.(null);
        this.emitState();
    }

    private castMeteor(side: Side, x: number, y: number): void {
        this.meteors.push({ x, y, ownerSide: side, remMs: METEOR.telegraphMs });
    }

    private castRally(side: Side): void {
        if (side === 'player') this.playerRallyMs = RALLY.durationMs;
        else this.enemyRallyMs = RALLY.durationMs;
        for (const u of this.units) {
            if (u.side === side && !u.isDead) u.rallyMs = RALLY.durationMs;
        }
        const color = side === 'player' ? '#268bd2' : '#dc322f';
        fx.banner(this, BOARD_WIDTH / 2, 60, '📣 戰吼！', color, 500, 28);
    }

    // ── 控制 ──
    setSpeed(speed: number): void {
        this.speedMul = speed;
        this.emitState();
    }

    togglePause(): void {
        this.paused = !this.paused;
        this.emitState();
    }

    // ── 結算 ──
    private checkEnd(): void {
        if (this.status !== 'playing') return;
        if (this.enemyKeep.isDestroyed) this.endMatch('won');
        else if (this.playerKeep.isDestroyed) this.endMatch('lost');
    }

    private endMatch(result: GameStatus): void {
        this.status = result;
        const win = result === 'won';
        fx.banner(this, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, win ? '🎉 攻陷敵堡！' : '💥 主堡淪陷', win ? '#859900' : '#dc322f', 1400, 48);
        if (win) this.cameras.main.flash(400, 200, 180, 80);
        this.emitState();
    }

    private emitState(): void {
        const snapshot: GameStateSnapshot = {
            gold: Math.floor(this.playerEco.gold),
            income: this.playerEco.income,
            cp: Math.floor(this.playerEco.cp),
            cpMax: this.playerEco.cpMax,
            playerKeepHp: Math.max(0, Math.ceil(this.playerKeep.hp)),
            playerKeepMax: this.playerKeep.maxHp,
            enemyKeepHp: Math.max(0, Math.ceil(this.enemyKeep.hp)),
            enemyKeepMax: this.enemyKeep.maxHp,
            incomeLvl: this.playerEco.incomeLvl,
            incomeCost: this.playerEco.incomeCost,
            keepLvl: this.playerEco.keepLvl,
            keepCost: this.playerEco.keepCost,
            status: this.status,
            difficulty: this.difficulty,
            speed: this.speedMul,
            paused: this.paused,
            scouting: this.scoutMs > 0,
            rallyMs: this.playerRallyMs,
        };
        this.callbacks.onStateChange?.(snapshot);
    }

    // ── 背景 ──
    private drawBackground(): void {
        const g = this.add.graphics().setDepth(0);
        // 天空漸層
        g.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
        g.fillRect(0, 0, BOARD_WIDTH, GROUND_Y);
        // 遠山
        g.fillStyle(COLORS.hills, 0.8);
        g.fillEllipse(BOARD_WIDTH * 0.28, GROUND_Y + 10, 460, 150);
        g.fillEllipse(BOARD_WIDTH * 0.72, GROUND_Y + 14, 520, 130);
        // 地面漸層
        g.fillGradientStyle(COLORS.groundTop, COLORS.groundTop, COLORS.groundBottom, COLORS.groundBottom, 1);
        g.fillRect(0, GROUND_Y, BOARD_WIDTH, BOARD_HEIGHT - GROUND_Y);
        // 中線
        g.lineStyle(2, COLORS.gridLine, 0.5);
        g.lineBetween(BOARD_WIDTH / 2, GROUND_Y, BOARD_WIDTH / 2, BOARD_HEIGHT);
        // 地平線
        g.lineStyle(2, COLORS.cyan, 0.18);
        g.lineBetween(0, GROUND_Y, BOARD_WIDTH, GROUND_Y);
    }
}
