import { UNIT_DEFS } from '../data/units';
import type { AbilityType, Difficulty, Point, UnitType } from '../types';

/** AI 每次思考可回傳的行動 */
export type AIAction =
    | { kind: 'spawn'; unit: UnitType }
    | { kind: 'income' }
    | { kind: 'keep' }
    | { kind: 'ability'; ability: AbilityType; point?: Point };

/** AI 思考時取得的戰況視野 */
export interface AIView {
    gold: number;
    cp: number;
    incomeLvl: number;
    keepCost: number;
    incomeCost: number;
    ownUnitCount: number;
    foeUnitCount: number;
    foeCounts: Record<UnitType, number>;
    ownKeepHpRatio: number;
    foeKeepHpRatio: number;
    /** 玩家部隊最密集處的數量與中心（供隕石瞄準） */
    clusterSize: number;
    clusterPoint: Point | null;
    /** AI 部隊是否已推進到玩家半場 */
    pushing: boolean;
}

interface AIParams {
    thinkIntervalMs: number;
    incomeMultiplier: number;
    counterAware: boolean;
    usesAbilities: boolean;
    investBias: number; // 升級經濟的傾向 0~1
}

const PARAMS: Record<Difficulty, AIParams> = {
    easy: { thinkIntervalMs: 2300, incomeMultiplier: 0.85, counterAware: false, usesAbilities: false, investBias: 0.18 },
    normal: { thinkIntervalMs: 1600, incomeMultiplier: 1.0, counterAware: true, usesAbilities: true, investBias: 0.32 },
    hard: { thinkIntervalMs: 1100, incomeMultiplier: 1.28, counterAware: true, usesAbilities: true, investBias: 0.42 },
};

/** 對方主力兵種 → 該出來剋制它的兵種 */
const COUNTER_PICK: Record<UnitType, UnitType> = {
    shield: 'archer',
    cavalry: 'shield',
    archer: 'cavalry',
    mage: 'cavalry',
    cleric: 'cavalry',
};

/**
 * 敵方 AI：以同一套公開動作（產兵 / 升級 / 技能）對抗玩家。
 * 依難度調整思考頻率、經濟倍率、是否懂相剋與使用技能。
 */
export class AIController {
    readonly incomeMultiplier: number;
    private params: AIParams;
    private timer = 0;

    constructor(difficulty: Difficulty) {
        this.params = PARAMS[difficulty];
        this.incomeMultiplier = this.params.incomeMultiplier;
    }

    /** 推進思考計時；到點則產生一批行動 */
    tick(dtMs: number, view: AIView): AIAction[] {
        this.timer -= dtMs;
        if (this.timer > 0) return [];
        this.timer = this.params.thinkIntervalMs;
        return this.decide(view);
    }

    private decide(view: AIView): AIAction[] {
        const actions: AIAction[] = [];
        const p = this.params;

        // 1) 技能
        if (p.usesAbilities) {
            if (view.cp >= 3 && view.clusterSize >= 4 && view.clusterPoint) {
                actions.push({ kind: 'ability', ability: 'meteor', point: view.clusterPoint });
            } else if (view.cp >= 2 && view.pushing && view.foeKeepHpRatio < 0.6) {
                actions.push({ kind: 'ability', ability: 'rally' });
            }
        }

        // 2) 主堡告急 → 補血
        if (view.ownKeepHpRatio < 0.5 && view.gold >= view.keepCost) {
            actions.push({ kind: 'keep' });
            return actions;
        }

        // 3) 安全且不缺兵 → 投資經濟
        const safe = view.foeUnitCount <= view.ownUnitCount + 1 && view.ownKeepHpRatio > 0.7;
        if (safe && view.gold >= view.incomeCost && Math.random() < p.investBias) {
            actions.push({ kind: 'income' });
            return actions;
        }

        // 4) 產兵：挑剋制玩家主力的兵種
        const pick = this.pickUnit(view);
        if (pick && view.gold >= UNIT_DEFS[pick].cost) {
            actions.push({ kind: 'spawn', unit: pick });
        }
        return actions;
    }

    private pickUnit(view: AIView): UnitType | null {
        if (!this.params.counterAware) {
            const pool: UnitType[] = ['shield', 'archer', 'cavalry'];
            return pool[Math.floor(Math.random() * pool.length)];
        }

        // 找玩家最多的兵種
        let dominant: UnitType | null = null;
        let max = 0;
        (Object.keys(view.foeCounts) as UnitType[]).forEach((t) => {
            if (view.foeCounts[t] > max) {
                max = view.foeCounts[t];
                dominant = t;
            }
        });

        let pick: UnitType = dominant ? COUNTER_PICK[dominant] : 'shield';
        // 偶爾補強自身陣容（法師清群 / 牧師續航）
        const roll = Math.random();
        if (roll < 0.16) pick = 'mage';
        else if (roll < 0.26) pick = 'cleric';

        // 買不起就退而求其次出盾兵
        if (view.gold < UNIT_DEFS[pick].cost && view.gold >= UNIT_DEFS.shield.cost) {
            return 'shield';
        }
        return pick;
    }
}
