/**
 * 經濟與生命狀態（不依賴 Phaser）
 */

export class Economy {
    gold: number;
    lives: number;

    constructor(startGold: number, startLives: number) {
        this.gold = startGold;
        this.lives = startLives;
    }

    canAfford(cost: number): boolean {
        return this.gold >= cost;
    }

    /** 嘗試花費，成功回傳 true */
    spend(cost: number): boolean {
        if (!this.canAfford(cost)) return false;
        this.gold -= cost;
        return true;
    }

    earn(amount: number): void {
        this.gold += amount;
    }

    loseLife(amount: number): void {
        this.lives = Math.max(0, this.lives - amount);
    }

    get isDead(): boolean {
        return this.lives <= 0;
    }
}
