/**
 * 《彈道對決》AI 對手 — 規則式，不需要模型。
 *
 * 做法是「用同一套物理去試打」：對 (角度, 力道) 做粗掃描再局部細掃描，
 * 直接呼叫 Core.simulate 評分，所以翻山、自傷這些狀況會自動被考慮進去，
 * 不需要另外寫閉式解（閉式解也跟離散積分的實際彈道對不齊）。
 *
 * 最後在最佳解上疊加固定標準差的高斯誤差 —— 誤差不隨對戰過程收斂，
 * AI 每一發都是重新算、重新抖，不記憶上一發打偏多少。
 */

import { AlgorithmAgent, type PredictionResult } from '@/lib/ai/core/Agent';
import { ArtilleryCore } from '@/lib/games/artillery/ArtilleryCore';
import { AI, AIM, COMBAT } from '@/lib/games/artillery/config';
import { clamp, gaussian, mulberry32, type Rng } from '@/lib/games/artillery/random';
import type { ArtilleryState, Side } from '@/lib/games/artillery/types';

export interface ArtilleryPlan {
    angle: number;
    power: number;
}

export interface ArtilleryAgentConfig {
    /** 前向模型：AI 用它反覆試打來找解 */
    core: ArtilleryCore;
    /** 注入亂數來源，測試可釘住種子 */
    rng?: Rng;
    angleSigma?: number;
    powerSigma?: number;
}

interface Candidate {
    angle: number;
    power: number;
    score: number;
}

export class ArtilleryAgent extends AlgorithmAgent<ArtilleryState, ArtilleryPlan> {
    private readonly core: ArtilleryCore;
    private readonly rng: Rng;
    private readonly angleSigma: number;
    private readonly powerSigma: number;

    constructor(config: ArtilleryAgentConfig) {
        super();
        this.core = config.core;
        this.rng = config.rng ?? mulberry32(Math.floor(Math.random() * 0xffffffff));
        this.angleSigma = config.angleSigma ?? AI.angleSigma;
        this.powerSigma = config.powerSigma ?? AI.powerSigma;
    }

    async predict(state: ArtilleryState): Promise<PredictionResult<ArtilleryPlan>> {
        const shooter: Side = 'enemy';
        const target: Side = 'player';

        const coarse = this.scan(
            shooter,
            target,
            { from: AIM.minAngle + 10, to: AIM.maxAngle - 5, step: AI.coarseAngleStep },
            { from: 15, to: AIM.maxPower, step: AI.coarsePowerStep }
        );

        const best = this.scan(
            shooter,
            target,
            {
                from: coarse.angle - AI.refineSpan,
                to: coarse.angle + AI.refineSpan,
                step: AI.refineStep,
            },
            {
                from: coarse.power - AI.refineSpan,
                to: coarse.power + AI.refineSpan,
                step: AI.refineStep,
            },
            coarse
        );

        const plan: ArtilleryPlan = {
            angle: clamp(best.angle + gaussian(this.rng) * this.angleSigma, AIM.minAngle, AIM.maxAngle),
            power: clamp(best.power + gaussian(this.rng) * this.powerSigma, 5, AIM.maxPower),
        };

        return {
            action: plan,
            confidence: best.score === Infinity ? 0 : 1 / (1 + best.score / COMBAT.blastRadius),
            info: { idealAngle: best.angle, idealPower: best.power, idealScore: best.score },
        };
    }

    private scan(
        shooter: Side,
        target: Side,
        angleRange: { from: number; to: number; step: number },
        powerRange: { from: number; to: number; step: number },
        seedBest?: Candidate
    ): Candidate {
        let best: Candidate = seedBest ?? { angle: 45, power: 60, score: Infinity };

        const angleFrom = clamp(angleRange.from, AIM.minAngle, AIM.maxAngle);
        const angleTo = clamp(angleRange.to, AIM.minAngle, AIM.maxAngle);
        const powerFrom = clamp(powerRange.from, 5, AIM.maxPower);
        const powerTo = clamp(powerRange.to, 5, AIM.maxPower);

        for (let angle = angleFrom; angle <= angleTo; angle += angleRange.step) {
            for (let power = powerFrom; power <= powerTo; power += powerRange.step) {
                const score = this.evaluate(shooter, target, angle, power);
                if (score < best.score) {
                    best = { angle, power, score };
                }
            }
        }

        return best;
    }

    /** 評分：落點離目標越近越好，會炸到自己的解要被推開 */
    private evaluate(shooter: Side, target: Side, angle: number, power: number): number {
        const shot = this.core.simulate(shooter, angle, power, false);
        if (!shot.impact) return Infinity;

        if (shot.hitTurret === target) return 0;

        const targetCenter = this.core.centerOf(target);
        const distance = Math.hypot(shot.impact.x - targetCenter.x, shot.impact.y - targetCenter.y);

        const selfDamage = ArtilleryCore.damageAt(
            shot.impact,
            this.core.centerOf(shooter),
            shot.hitTurret === shooter
        );

        return distance + selfDamage * 5;
    }
}
