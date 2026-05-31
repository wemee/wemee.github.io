/**
 * 波次排程器（不依賴 Phaser）
 * 將一波 WaveDef 攤平成依時間排序的 spawn 清單，依累積時間觸發。
 */

import type { WaveDef } from '../data/waves';
import type { EnemyType } from '../types';

interface ScheduledSpawn {
    type: EnemyType;
    time: number; // 自該波開始的毫秒數
}

export class WaveManager {
    private schedule: ScheduledSpawn[] = [];
    private elapsed = 0;
    private idx = 0;
    private active = false;

    /** 開始一波 */
    startWave(wave: WaveDef): void {
        this.schedule = this.build(wave);
        this.elapsed = 0;
        this.idx = 0;
        this.active = true;
    }

    /** 推進排程，對到期的 spawn 呼叫 callback */
    update(dtMs: number, spawn: (type: EnemyType) => void): void {
        if (!this.active) return;
        this.elapsed += dtMs;
        while (this.idx < this.schedule.length && this.schedule[this.idx].time <= this.elapsed) {
            spawn(this.schedule[this.idx].type);
            this.idx++;
        }
        if (this.idx >= this.schedule.length) this.active = false;
    }

    /** 是否仍在 spawn 中 */
    get isSpawning(): boolean {
        return this.active;
    }

    private build(wave: WaveDef): ScheduledSpawn[] {
        const out: ScheduledSpawn[] = [];
        for (const group of wave.groups) {
            const offset = group.startDelayMs ?? 0;
            for (let i = 0; i < group.count; i++) {
                out.push({ type: group.type, time: offset + i * group.intervalMs });
            }
        }
        out.sort((a, b) => a.time - b.time);
        return out;
    }
}
