// 共用核心：所有機台共用的狀態骨架、持珠帳本、發射迴圈、事件、工具。
// 各機台只實作自己的 shoot() 邏輯與導覽文字，不重複寫帳本。
// （由原本 window.PACHINKO IIFE 版本移植成 ESM，邏輯保持不變。）

export interface Port {
  label: string;
  on: boolean;
}

export interface StatRow {
  label: string;
  value: string | number;
  color?: string;
}

export interface GuideInfo {
  step: string;
  title: string;
  goal: string;
  prob: string;
  hint: string;
}

export interface FlowItem {
  no?: string;
  id?: string;
  title?: string;
  dir?: string;
  desc?: string;
  arrow?: string;
}

export interface WeightedRounds {
  rounds: number;
  weight: number;
}

export interface MachineSpec {
  id: string;
  name: string;
  startBalls: number;
  insertAmount: number;
  [key: string]: unknown;
}

export interface PachinkoState {
  phase: string;
  balls: number;
  invested: number;
  totalLaunched: number;
  consecutiveWins: number;
  shootDirection: 'LEFT' | 'RIGHT';
  [key: string]: unknown;
}

export interface PachinkoEvent {
  type: string;
  state: PachinkoState;
}

export interface Machine {
  spec: MachineSpec;
  initialPhase?: string;
  hasReels: boolean;
  note?: string;
  initialExtra?: () => Record<string, unknown>;
  shoot: (core: Core) => void;
  ports: (state: PachinkoState) => Port[];
  stats: (state: PachinkoState) => StatRow[];
  guide: (state: PachinkoState) => GuideInfo;
  flow: FlowItem[];
  describe?: (evt: PachinkoEvent) => string | null;
}

export interface Core {
  spec: MachineSpec;
  machine: Machine;
  on: (fn: (evt: PachinkoEvent) => void) => void;
  snapshot: () => PachinkoState;
  emit: (type: string) => void;
  readonly state: PachinkoState;
  addBalls: (n: number) => void;
  insert: () => void;
  reset: () => void;
  shoot: () => void;
}

// 共用工具
export const util = {
  // 依權重表抽一項，回傳整個項目
  pickWeighted<T extends { weight: number }>(table: T[]): T {
    const total = table.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of table) {
      r -= t.weight;
      if (r < 0) return t;
    }
    return table[table.length - 1];
  },
  // 數字盤：matching = 三個相同（中獎）
  randomReels(matching: boolean): [number, number, number] {
    if (matching) {
      const n = (Math.random() * 10) | 0;
      return [n, n, n];
    }
    let a: number, b: number, c: number;
    do {
      a = (Math.random() * 10) | 0;
      b = (Math.random() * 10) | 0;
      c = (Math.random() * 10) | 0;
    } while (a === b && b === c);
    return [a, b, c];
  },
};

// 建立一台機器：傳入機台模組定義，回傳統一介面的引擎
export function createCore(machine: Machine): Core {
  const spec = machine.spec;
  const listeners: Array<(evt: PachinkoEvent) => void> = [];
  let state: PachinkoState;

  function init() {
    state = Object.assign(
      {
        phase: machine.initialPhase || 'NORMAL',
        balls: spec.startBalls,
        invested: spec.startBalls, // 累計投入（換算投資）
        totalLaunched: 0,
        consecutiveWins: 0, // 連莊／大當り計數
        shootDirection: 'LEFT' as const,
      },
      machine.initialExtra ? machine.initialExtra() : {}
    );
  }
  init();

  function snapshot(): PachinkoState {
    return JSON.parse(JSON.stringify(state));
  }
  function emit(type: string) {
    const evt: PachinkoEvent = { type, state: snapshot() };
    listeners.forEach((fn) => fn(evt));
  }

  const core: Core = {
    spec,
    machine,
    on: (fn) => listeners.push(fn),
    snapshot,
    emit,
    get state() {
      return state;
    },
    addBalls(n: number) {
      state.balls += n;
    },
    insert() {
      state.balls += spec.insertAmount;
      state.invested += spec.insertAmount;
      emit('insert');
    },
    reset() {
      init();
      emit('reset');
    },
    shoot() {
      if (state.balls <= 0) {
        emit('empty');
        return;
      }
      state.balls -= 1;
      state.totalLaunched += 1;
      machine.shoot(core);
    },
  };
  return core;
}
