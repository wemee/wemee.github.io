// デジパチ（1種 ST）：啟動口 → 數字盤抽選 → 大當り → 突入率 45% → RUSH 連莊。
// 對標真機シンフォギア3 甘デジ(Light)，回收率校準至 ≈ 88%。
import { util as U, type Core, type Machine, type PachinkoEvent, type WeightedRounds } from '../core';

const spec = {
  id: 'digipachi',
  name: 'デジパチ（1種 ST・甘デジ）',
  startBalls: 250,
  insertAmount: 250,

  startPocketProb: 0.072, // 進啟動口（ヘソ）→ 約 18 回轉/250 顆
  startReward: 1,
  normalJackpotProb: 1 / 99.9,

  ballsPerRound: 10,
  attackerProb: 0.9,
  attackerReward: 7,

  firstHitRounds: [
    { rounds: 10, weight: 0.5 },
    { rounds: 3, weight: 99.5 },
  ] as WeightedRounds[],
  entryRushProb: 0.45,
  rushRounds: [
    { rounds: 3, weight: 80 },
    { rounds: 9, weight: 5 },
    { rounds: 10, weight: 15 },
  ] as WeightedRounds[],

  stSpins: 100,
  stJackpotProb: 1 / 62, // 實質繼續率 ~80%
  stStartProb: 0.95,
  electricStartReward: 5,
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

function spin(core: Core, prob: number, firstHit: boolean, table: WeightedRounds[]) {
  const s = core.state as any;
  const hit = Math.random() < prob;
  s.reels = U.randomReels(hit);
  if (hit) {
    core.emit('spin-hit');
    enterJackpot(core, firstHit, table);
  } else {
    core.emit('spin-miss');
  }
}

function endJackpot(core: Core) {
  const s = core.state as any;
  if (s.wasFirstHit) {
    if (Math.random() < spec.entryRushProb) {
      s.phase = 'ST';
      s.stRemaining = spec.stSpins;
      s.shootDirection = 'RIGHT';
      core.emit('rush-in');
    } else {
      s.phase = 'NORMAL';
      s.consecutiveWins = 0;
      s.shootDirection = 'LEFT';
      core.emit('rush-fail');
    }
  } else {
    s.phase = 'ST';
    s.stRemaining = spec.stSpins;
    s.shootDirection = 'RIGHT';
    core.emit('jackpot-end');
  }
}

const machine: Machine = {
  spec,
  initialPhase: 'NORMAL',
  hasReels: true,
  note: '長期回收率 ≈ 88%（玩越久越虧，靠運氣連莊翻身）',

  initialExtra() {
    return { reels: [0, 0, 0], round: 0, totalRounds: 0, ballsInRound: 0, wasFirstHit: false, stRemaining: 0 };
  },

  shoot(core) {
    const s = core.state as any;
    if (s.phase === 'NORMAL') {
      if (Math.random() < spec.startPocketProb) {
        core.addBalls(spec.startReward);
        core.emit('start-pocket');
        spin(core, spec.normalJackpotProb, true, spec.firstHitRounds);
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
        core.emit('electric');
        spin(core, spec.stJackpotProb, false, spec.rushRounds);
        if (s.phase === 'ST' && s.stRemaining <= 0) {
          s.phase = 'NORMAL';
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
        goal: '把珠打進「啟動口」，每進一次抽一次大當り',
        prob: '大當り 1/99.9（約 100 次抽選中 1 次）',
        hint: '慢慢虧珠、等中獎的階段。打法：左打。',
      };
    if (s.phase === 'JACKPOT' && s.wasFirstHit)
      return {
        step: 'first',
        title: '② 初當り（' + s.totalRounds + 'R）',
        goal: '右打把珠塞進「大入賞口」吃出玉',
        prob: '打完抽「突入率 45%」決定能否進 RUSH',
        hint: '初當り多半是小 3R，真正的錢在 RUSH。打法：右打。',
      };
    if (s.phase === 'JACKPOT')
      return {
        step: 'rush',
        title: '連莊大當り（' + s.totalRounds + 'R）',
        goal: '右打繼續吃出玉，打完自動回 RUSH',
        prob: '連莊中！',
        hint: '這是獲利的時候。打法：右打。',
      };
    return {
      step: 'rush',
      title: '③ RUSH／ST',
      goal: '在剩餘 ' + s.stRemaining + ' 轉內再中大當り',
      prob: '實質繼續率 ~80%（平均連莊約 4 次）',
      hint: '連莊區，獲利來源。轉數用盡沒中就回通常時。打法：右打。',
    };
  },

  flow: [
    { no: '①', id: 'normal', title: '通常時', dir: '左打', desc: '打珠進啟動口，每進一次抽一次：大當り 1/99.9' },
    { arrow: '↓ 中大當り' },
    { no: '②', id: 'first', title: '初當り', dir: '右打', desc: '幾乎都是小 3R（約 180 顆）。打完抽突入率 45%' },
    { arrow: '↓ 突入成功 45%（失敗回 ①）' },
    { no: '③', id: 'rush', title: 'RUSH／ST', dir: '右打', desc: '連莊區。100 轉內再中即續戰：繼續率 ~80%' },
    { arrow: '↺ 連莊（③→②→③）／ 陷落 → 回 ①' },
  ],

  describe(evt: PachinkoEvent) {
    const s = evt.state as any;
    switch (evt.type) {
      case 'start-pocket':
        return '珠進啟動口 +' + spec.startReward + '（持珠 ' + s.balls + '）';
      case 'electric':
        return '珠進電チュー +' + spec.electricStartReward + '（持珠 ' + s.balls + '）';
      case 'attacker-in':
        return '珠進大入賞口 +' + spec.attackerReward + '（持珠 ' + s.balls + '）';
      case 'spin-hit':
        return '🎉 抽中！ ' + s.reels.join('');
      case 'spin-miss':
        return '抽選落選 ' + s.reels.join('');
      case 'jackpot-start':
        return '=== ' + s.totalRounds + 'R 大當り開始（連莊 ' + s.consecutiveWins + '）→ 右打 ===';
      case 'rush-in':
        return '🔥 初當り突入 RUSH！（45% 突入率）';
      case 'rush-fail':
        return '… 初當り未突入（55% 落空）→ 回通常時';
      case 'jackpot-end':
        return '連莊成功！繼續 RUSH（' + s.stRemaining + ' 轉）';
      case 'back-to-normal':
        return '--- RUSH 用盡，回通常時 → 左打 ---';
      default:
        return null;
    }
  },
};

export default machine;
