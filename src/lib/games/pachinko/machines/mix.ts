// 1種2種混合：通常時是 1種（ヘソ→數字盤抽選→大當り），初當り 100% 突入 RUSH。
// RUSH 是 2種：電チュー → 小當り → 珠通過 V → 大當り（連莊）。靠小當り→V 高繼續。
import { util as U, type Core, type Machine, type PachinkoEvent, type WeightedRounds } from '../core';

const spec = {
  id: 'mix',
  name: '1種2種混合（小當り→V）',
  startBalls: 250,
  insertAmount: 250,

  startPocketProb: 0.072,
  startReward: 1,
  normalJackpotProb: 1 / 99.9,

  ballsPerRound: 10,
  attackerProb: 0.9,
  attackerReward: 7,
  firstHitRounds: [{ rounds: 4, weight: 100 }] as WeightedRounds[], // 初當り 4R

  // RUSH（2種）：電チュー → 小當り → V（回收率校準 ≈ 85%）
  stSpins: 4, // ST 轉數較少
  stStartProb: 0.95,
  electricStartReward: 5,
  kouatariProb: 1 / 3, // 電チュー抽選 → 小當り 機率
  vProbRush: 0.78, // 小當り中珠通過 V 機率 → 大當り（連莊）
  rushRounds: [
    { rounds: 4, weight: 70 },
    { rounds: 10, weight: 30 },
  ] as WeightedRounds[],
};

function enterJackpot(core: Core, firstHit: boolean, table: WeightedRounds[]) {
  const s = core.state as any;
  s.phase = 'JACKPOT';
  s.wasFirstHit = firstHit;
  s.totalRounds = U.pickWeighted(table).rounds;
  s.round = 1;
  s.ballsInRound = 0;
  s.consecutiveWins += 1;
  s.shootDirection = 'RIGHT';
  core.emit('jackpot-start');
}

function endJackpot(core: Core) {
  const s = core.state as any;
  // 混合機：初當り 100% 突入，連莊當り也回 RUSH
  s.phase = 'ST';
  s.stRemaining = spec.stSpins;
  s.shootDirection = 'RIGHT';
  core.emit(s.wasFirstHit ? 'rush-in' : 'jackpot-end');
}

const machine: Machine = {
  spec,
  initialPhase: 'NORMAL',
  hasReels: true,
  note: '繼續率高、突入率 100%，連莊靠「小當り→V」的 2 種機制。',

  initialExtra() {
    return { reels: [0, 0, 0], round: 0, totalRounds: 0, ballsInRound: 0, wasFirstHit: false, stRemaining: 0, vOpen: false };
  },

  shoot(core) {
    const s = core.state as any;
    if (s.phase === 'NORMAL') {
      if (Math.random() < spec.startPocketProb) {
        core.addBalls(spec.startReward);
        core.emit('start-pocket');
        const hit = Math.random() < spec.normalJackpotProb;
        s.reels = U.randomReels(hit);
        if (hit) {
          core.emit('spin-hit');
          enterJackpot(core, true, spec.firstHitRounds);
        } else {
          core.emit('spin-miss');
        }
      } else {
        core.emit('launch-miss');
      }
    } else if (s.phase === 'JACKPOT') {
      if (Math.random() < spec.attackerProb) {
        core.addBalls(spec.attackerReward);
        s.ballsInRound += 1;
        core.emit('attacker-in');
        if (s.ballsInRound >= spec.ballsPerRound) {
          if (s.round >= s.totalRounds) endJackpot(core);
          else {
            s.round += 1;
            s.ballsInRound = 0;
            core.emit('round-next');
          }
        }
      } else {
        core.emit('launch-miss');
      }
    } else if (s.phase === 'ST') {
      if (Math.random() < spec.stStartProb) {
        core.addBalls(spec.electricStartReward);
        s.stRemaining -= 1;
        if (Math.random() < spec.kouatariProb) {
          core.emit('kouatari'); // 抽中小當り → 大入賞口開、狙 V
          if (Math.random() < spec.vProbRush) {
            s.vOpen = true;
            core.emit('v-hit');
            enterJackpot(core, false, spec.rushRounds);
          } else {
            core.emit('v-miss'); // 小當り但沒進 V，不續莊
          }
        } else {
          core.emit('st-miss');
        }
        if (s.phase === 'ST' && s.stRemaining <= 0) {
          s.phase = 'NORMAL';
          s.vOpen = false;
          s.consecutiveWins = 0;
          s.shootDirection = 'LEFT';
          core.emit('back-to-normal');
        }
      } else {
        core.emit('launch-miss');
      }
    }
  },

  ports(state) {
    return [
      { label: '啟動口', on: state.phase === 'NORMAL' },
      { label: '電チュー', on: state.phase === 'ST' },
      { label: 'V', on: state.phase === 'ST' },
      { label: '大入賞口', on: state.phase === 'JACKPOT' },
    ];
  },

  stats(state) {
    const s = state as any;
    return [
      { label: '回合', value: s.phase === 'JACKPOT' ? s.round + '/' + s.totalRounds + 'R' : '—' },
      { label: 'ST 殘餘', value: s.phase === 'ST' ? s.stRemaining : '—' },
      { label: '連莊', value: s.consecutiveWins },
    ];
  },

  guide(state) {
    const s = state as any;
    if (s.phase === 'NORMAL')
      return {
        step: 'normal',
        title: '① 通常時',
        goal: '把珠打進「啟動口」，數字盤抽大當り',
        prob: '大當り 1/99.9',
        hint: '和デジパチ一樣的 1 種抽選。打法：左打。',
      };
    if (s.phase === 'JACKPOT' && s.wasFirstHit)
      return {
        step: 'first',
        title: '② 初當り（' + s.totalRounds + 'R）',
        goal: '右打吃出玉，打完 100% 突入 RUSH',
        prob: '突入率 100%（混合機特徵）',
        hint: '初當り一定進連莊區，和デジパチ不同。打法：右打。',
      };
    if (s.phase === 'JACKPOT')
      return {
        step: 'rush',
        title: '連莊大當り（' + s.totalRounds + 'R）',
        goal: '右打吃出玉，打完回 RUSH 續戰',
        prob: '連莊中！',
        hint: '由小當り→V 觸發的大當り。打法：右打。',
      };
    return {
      step: 'rush',
      title: '③ RUSH（2 種）',
      goal: '電チュー抽小當り，再讓珠通過 V → 連莊',
      prob: '小當り 1/3 × 進 V 78%，' + s.stRemaining + ' 轉內',
      hint: '連莊要珠「物理通過 V」確認，這是 2 種機制。打法：右打。',
    };
  },

  flow: [
    { no: '①', id: 'normal', title: '通常時', dir: '左打', desc: '啟動口 → 數字盤抽選：大當り 1/99.9' },
    { arrow: '↓ 中大當り（初當り 4R）' },
    { no: '②', id: 'first', title: '初當り → 突入', dir: '右打', desc: '突入率 100%，必進 RUSH' },
    { arrow: '↓' },
    { no: '③', id: 'rush', title: 'RUSH（2 種）', dir: '右打', desc: '電チュー→小當り→珠進 V→大當り（高繼續）' },
    { arrow: '↺ 連莊 ／ 轉數用盡 → 回 ①' },
  ],

  describe(evt: PachinkoEvent) {
    const s = evt.state as any;
    switch (evt.type) {
      case 'start-pocket':
        return '珠進啟動口 +' + spec.startReward + '（持珠 ' + s.balls + '）';
      case 'attacker-in':
        return '珠進大入賞口 +' + spec.attackerReward + '（持珠 ' + s.balls + '）';
      case 'spin-hit':
        return '🎉 抽中大當り！ ' + s.reels.join('');
      case 'spin-miss':
        return '抽選落選 ' + s.reels.join('');
      case 'jackpot-start':
        return '=== ' + s.totalRounds + 'R 大當り開始（連莊 ' + s.consecutiveWins + '）===';
      case 'rush-in':
        return '🔥 初當り → 100% 突入 RUSH！';
      case 'kouatari':
        return '小當り！大入賞口開、狙 V…';
      case 'v-hit':
        return '✅ 珠通過 V → 連莊大當り！';
      case 'v-miss':
        return '✗ 小當り但沒進 V';
      case 'back-to-normal':
        return '--- RUSH 用盡，回通常時 → 左打 ---';
      default:
        return null;
    }
  },
};

export default machine;
