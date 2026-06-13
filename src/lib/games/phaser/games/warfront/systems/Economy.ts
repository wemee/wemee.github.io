import { ECONOMY } from '../config';

/** 收入升級成本（依目前等級） */
export function incomeUpgradeCost(level: number): number {
    return Math.round(ECONOMY.incomeCostBase * Math.pow(ECONOMY.incomeCostGrowth, level));
}

/** 主堡升級成本（依目前等級） */
export function keepUpgradeCost(level: number): number {
    return Math.round(ECONOMY.keepCostBase * Math.pow(ECONOMY.keepCostGrowth, level));
}

/**
 * 單方經濟：金幣、每秒收入、指揮值（CP）。
 * 主堡升級等級也記在這裡（主堡 HP 本身由 Keep 實體管理）。
 */
export class Economy {
    gold: number;
    income: number;
    incomeLvl = 0;
    keepLvl = 0;
    cp: number;
    readonly cpMax: number;

    private readonly cpPerSec: number;

    constructor() {
        this.gold = ECONOMY.startGold;
        this.income = ECONOMY.baseIncome;
        this.cp = ECONOMY.cpStart;
        this.cpMax = ECONOMY.cpMax;
        this.cpPerSec = 1000 / ECONOMY.cpRegenMs;
    }

    /** 推進一個時間步（秒，遊戲內時間） */
    tick(dtSec: number): void {
        this.gold += this.income * dtSec;
        this.cp = Math.min(this.cpMax, this.cp + dtSec * this.cpPerSec);
    }

    canAfford(cost: number): boolean {
        return this.gold >= cost;
    }

    spend(cost: number): boolean {
        if (this.gold < cost) return false;
        this.gold -= cost;
        return true;
    }

    earn(amount: number): void {
        this.gold += amount;
    }

    canAffordCp(cost: number): boolean {
        return this.cp >= cost;
    }

    spendCp(cost: number): boolean {
        if (this.cp < cost) return false;
        this.cp -= cost;
        return true;
    }

    get incomeCost(): number {
        return incomeUpgradeCost(this.incomeLvl);
    }

    get keepCost(): number {
        return keepUpgradeCost(this.keepLvl);
    }

    upgradeIncome(): boolean {
        if (!this.spend(this.incomeCost)) return false;
        this.incomeLvl++;
        this.income += ECONOMY.incomeStep;
        return true;
    }
}
