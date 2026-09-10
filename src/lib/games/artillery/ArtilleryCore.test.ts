import { describe, test, expect } from 'vitest';
import { ArtilleryCore } from './ArtilleryCore';
import { ArtilleryAgent } from '@/lib/ai/agents/ArtilleryAgent';
import { AIM, COMBAT, FIELD, PHYSICS, TERRAIN, TURRET } from './config';
import { groundYAt } from './terrain';
import { mulberry32 } from './random';

const SEEDS = [1, 7, 42, 1234, 99999, 2026];

const makeCore = (seed: number) => new ArtilleryCore({ seed });

describe('地形產生', () => {
    test.each(SEEDS)('種子 %i 的地表高度落在容許範圍內', (seed) => {
        const state = makeCore(seed).getState();
        const minY = FIELD.height * TERRAIN.minYRatio;
        const maxY = FIELD.height * TERRAIN.maxYRatio;

        for (const y of state.groundYs) {
            expect(y).toBeGreaterThanOrEqual(minY - 0.001);
            expect(y).toBeLessThanOrEqual(maxY + 0.001);
        }
    });

    test.each(SEEDS)('種子 %i 的兩座砲台都站在壓平的平台上', (seed) => {
        const core = makeCore(seed);
        const state = core.getState();

        for (const turret of [state.turrets.player, state.turrets.enemy]) {
            expect(turret.y).toBeCloseTo(core.groundAt(turret.x), 5);

            const left = groundYAt(state.groundYs, state.width, turret.x - TERRAIN.padHalfWidth + 4);
            const right = groundYAt(state.groundYs, state.width, turret.x + TERRAIN.padHalfWidth - 4);
            expect(Math.abs(left - turret.y)).toBeLessThan(1);
            expect(Math.abs(right - turret.y)).toBeLessThan(1);
        }
    });

    test('同一顆種子產生完全相同的地形', () => {
        const a = makeCore(2026).getState();
        const b = makeCore(2026).getState();
        expect(a.groundYs).toEqual(b.groundYs);
        expect(a.turrets.player.x).toBeCloseTo(b.turrets.player.x, 10);
    });
});

describe('彈道模擬', () => {
    test.each(SEEDS)('種子 %i：任何角度力道都會結束，不會無限飛', (seed) => {
        const core = makeCore(seed);
        for (let angle = AIM.minAngle; angle <= AIM.maxAngle; angle += 5) {
            for (let power = 5; power <= AIM.maxPower; power += 5) {
                const shot = core.simulate('player', angle, power);
                expect(shot.flightTime).toBeLessThan(PHYSICS.maxFlightTime);
                expect(shot.impact !== null || shot.outOfBounds).toBe(true);
            }
        }
    });

    test('落點會貼在地表上，不會穿進地底或懸空', () => {
        const core = makeCore(42);
        const shot = core.simulate('player', 55, 70);
        expect(shot.impact).not.toBeNull();
        expect(Math.abs(shot.impact!.y - core.groundAt(shot.impact!.x))).toBeLessThan(1.5);
    });

    test('滿力垂直射擊的最高點高過畫面頂端 — 再高的山也翻得過去', () => {
        const core = makeCore(42);
        const shot = core.simulate('player', 90, 100);
        const apex = Math.min(...shot.points.map((p) => p.y));
        expect(apex).toBeLessThan(0);
    });

    test('同樣角度下力道越大射得越遠', () => {
        const core = makeCore(7);
        const distances = [40, 60, 80].map((power) => {
            const shot = core.simulate('player', 40, power);
            return shot.impact ? shot.impact.x : Infinity;
        });
        expect(distances[1]).toBeGreaterThan(distances[0]);
        expect(distances[2]).toBeGreaterThan(distances[1]);
    });

    test('敵方砲彈往左飛，玩家砲彈往右飛', () => {
        const core = makeCore(7);
        const state = core.getState();
        const playerShot = core.simulate('player', 45, 60);
        const enemyShot = core.simulate('enemy', 45, 60);
        expect(playerShot.points[10].x).toBeGreaterThan(state.turrets.player.x);
        expect(enemyShot.points[10].x).toBeLessThan(state.turrets.enemy.x);
    });

    test('關掉記錄時不產生彈道點，結果仍相同', () => {
        const core = makeCore(42);
        const recorded = core.simulate('player', 50, 65, true);
        const silent = core.simulate('player', 50, 65, false);
        expect(silent.points).toHaveLength(0);
        expect(silent.impact).toEqual(recorded.impact);
        expect(silent.flightTime).toBeCloseTo(recorded.flightTime, 10);
    });
});

describe('傷害計算', () => {
    const center = { x: 500, y: 300 };

    test('直接命中的傷害最高', () => {
        const direct = ArtilleryCore.damageAt(center, center, true);
        const nearMiss = ArtilleryCore.damageAt({ x: 505, y: 300 }, center, false);
        expect(direct).toBe(COMBAT.directDamage);
        expect(direct).toBeGreaterThan(nearMiss);
    });

    test('傷害隨距離單調遞減，超出爆炸半徑歸零', () => {
        let previous = Infinity;
        for (let distance = 0; distance <= COMBAT.blastRadius; distance += 10) {
            const damage = ArtilleryCore.damageAt({ x: center.x + distance, y: center.y }, center, false);
            expect(damage).toBeLessThanOrEqual(previous);
            previous = damage;
        }
        expect(ArtilleryCore.damageAt({ x: center.x + COMBAT.blastRadius, y: center.y }, center, false)).toBe(0);
        expect(ArtilleryCore.damageAt({ x: center.x + 400, y: center.y }, center, false)).toBe(0);
    });
});

describe('回合流程', () => {
    test('雙方輪流開火，玩家回合開始時進入下一輪', () => {
        const core = makeCore(42);
        expect(core.getState().turn).toBe('player');

        core.step({ angle: 45, power: 20 });
        expect(core.getState().turn).toBe('enemy');
        expect(core.getState().round).toBe(1);

        core.step({ angle: 45, power: 20 });
        const state = core.getState();
        expect(state.turn).toBe('player');
        expect(state.round).toBe(2);
    });

    /**
     * 玩家每回合都用 45°／滿力空放（射程 1575 遠超過場寬，砲彈直接飛出場外不造成傷害），
     * 敵方用零誤差的 AI 每發必中，因此結局是可預測的：玩家被打到 0 血。
     */
    const playUntilEnemyWins = async (seed: number) => {
        const core = makeCore(seed);
        const agent = new ArtilleryAgent({ core, rng: mulberry32(seed), angleSigma: 0, powerSigma: 0 });

        let guard = 0;
        while (!core.getState().over && guard++ < 20) {
            core.step({ angle: 45, power: 100 });
            if (core.getState().over) break;
            const plan = (await agent.predict(core.getState())).action;
            core.step(plan);
        }
        return core;
    };

    test('打光血量就結束，並記錄勝方', async () => {
        const core = await playUntilEnemyWins(42);
        const state = core.getState();

        expect(state.over).toBe(true);
        expect(state.winner).toBe('enemy');
        expect(state.turrets.player.hp).toBe(0);
        expect(state.turrets.enemy.hp).toBe(COMBAT.maxHp);
        expect(state.round).toBeLessThanOrEqual(6);
    });

    test('遊戲結束後再開火不會改變狀態', async () => {
        const core = await playUntilEnemyWins(7);
        const before = core.getState();
        expect(before.over).toBe(true);

        const result = core.step({ angle: 10, power: 90 });

        expect(result.terminated).toBe(true);
        expect(result.reward).toBe(0);
        expect(result.observation.turrets.player.hp).toBe(before.turrets.player.hp);
        expect(result.observation.turrets.enemy.hp).toBe(before.turrets.enemy.hp);
        expect(result.observation.round).toBe(before.round);
    });
});

describe('AI 對手', () => {
    test.each(SEEDS)('種子 %i：AI 找得到能打到玩家的解（地形不會讓某方無解）', async (seed) => {
        const core = makeCore(seed);
        const agent = new ArtilleryAgent({
            core,
            rng: mulberry32(seed),
            angleSigma: 0,
            powerSigma: 0,
        });

        const result = await agent.predict(core.getState());
        expect(result.info!.idealScore).toBeLessThan(COMBAT.blastRadius);
    });

    test('固定誤差下的命中率落在合理區間 — 不會一發入魂也不會永遠打不到', async () => {
        const core = makeCore(42);
        const agent = new ArtilleryAgent({ core, rng: mulberry32(20260910) });
        const playerCenter = core.centerOf('player');

        let hits = 0;
        const samples = 120;
        for (let i = 0; i < samples; i++) {
            const plan = (await agent.predict(core.getState())).action;
            const shot = core.simulate('enemy', plan.angle, plan.power, false);
            if (!shot.impact) continue;
            const damage = ArtilleryCore.damageAt(shot.impact, playerCenter, shot.hitTurret === 'player');
            if (damage > 0) hits++;
        }

        const rate = hits / samples;
        expect(rate).toBeGreaterThan(0.15);
        expect(rate).toBeLessThan(0.75);
    });

    test('誤差為零時 AI 必定命中', async () => {
        const core = makeCore(7);
        const agent = new ArtilleryAgent({ core, rng: mulberry32(1), angleSigma: 0, powerSigma: 0 });
        const plan = (await agent.predict(core.getState())).action;
        const shot = core.simulate('enemy', plan.angle, plan.power, false);

        expect(shot.impact).not.toBeNull();
        const damage = ArtilleryCore.damageAt(shot.impact!, core.centerOf('player'), shot.hitTurret === 'player');
        expect(damage).toBeGreaterThan(0);
    });

    test('AI 不會挑會炸到自己的解', async () => {
        const core = makeCore(1234);
        const agent = new ArtilleryAgent({ core, rng: mulberry32(5), angleSigma: 0, powerSigma: 0 });
        const plan = (await agent.predict(core.getState())).action;
        const shot = core.simulate('enemy', plan.angle, plan.power, false);
        const selfDamage = ArtilleryCore.damageAt(shot.impact!, core.centerOf('enemy'), shot.hitTurret === 'enemy');
        expect(selfDamage).toBe(0);
    });
});

describe('砲口與命中判定', () => {
    test('砲口在砲台體外，剛出膛不會誤判打到自己', () => {
        const core = makeCore(42);
        const muzzle = core.muzzleOf('player', 45);
        const center = core.centerOf('player');
        expect(Math.hypot(muzzle.x - center.x, muzzle.y - center.y)).toBeGreaterThan(TURRET.radius);
    });

    test('高仰角低力道會砸回自己頭上（自傷成立）', () => {
        const core = makeCore(42);
        const before = core.getState().turrets.player.hp;
        core.step({ angle: 88, power: 8 });
        expect(core.getState().turrets.player.hp).toBeLessThan(before);
    });
});
