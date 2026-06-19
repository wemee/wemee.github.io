// 機台清單：載入順序即選單順序（デジパチ → 羽根物 → 混合）。
import type { Machine } from './core';
import digipachi from './machines/digipachi';
import hanemono from './machines/hanemono';
import mix from './machines/mix';

export const machines: Machine[] = [digipachi, hanemono, mix];

export { initPachinko } from './ui';
export type { Machine } from './core';
