// 羽根物（ハネモノ・2種）：沒有數字盤。
// 珠進始動口(チャッカー) → 羽根張開 → 趁機把珠送進役物中央的 V → 大當り。
// 大當り中羽根連續開閉吃球，每回合靠「V 再入賞」續行，最多 maxRounds。
import { type Machine, type PachinkoEvent } from '../core';

const spec = {
  id: 'hanemono',
  name: '羽根物（ハネモノ・2種）',
  startBalls: 250,
  insertAmount: 250,

  chuckerProb: 0.12, // 進始動口（チャッカー）→ 羽根張開
  chuckerReward: 3,
  vProbNormal: 1 / 50, // 羽根張開時珠進 V 的機率 → 大當り（回收率校準 ≈ 88%）

  ballsPerRound: 10, // 每回合役物吃球上限
  catchProb: 0.85, // 大當り中珠被役物吃進的機率
  attackerReward: 10,
  continueProb: 0.6, // 每回合 V 再入賞 → 續行
  maxRounds: 15,
};

const machine: Machine = {
  spec,
  initialPhase: 'NORMAL',
  hasReels: false,
  note: '出玉少但穩、射幸性低，是經典初學機種。',

  initialExtra() {
    return { round: 0, ballsInRound: 0, haneOpen: false };
  },

  shoot(core) {
    const s = core.state as any;
    if (s.phase === 'NORMAL') {
      if (Math.random() < spec.chuckerProb) {
        core.addBalls(spec.chuckerReward);
        s.haneOpen = true;
        core.emit('chucker');
        if (Math.random() < spec.vProbNormal) {
          s.phase = 'JACKPOT';
          s.round = 1;
          s.ballsInRound = 0;
          s.consecutiveWins += 1;
          s.shootDirection = 'RIGHT';
          core.emit('v-hit');
        } else {
          s.haneOpen = false;
          core.emit('v-miss');
        }
      } else {
        core.emit('launch-miss');
      }
    } else if (s.phase === 'JACKPOT') {
      if (Math.random() < spec.catchProb) {
        core.addBalls(spec.attackerReward);
        s.ballsInRound += 1;
        core.emit('attacker-in');
        if (s.ballsInRound >= spec.ballsPerRound) {
          if (s.round >= spec.maxRounds || Math.random() >= spec.continueProb) {
            s.phase = 'NORMAL';
            s.haneOpen = false;
            s.consecutiveWins = 0;
            s.shootDirection = 'LEFT';
            core.emit('jackpot-end');
          } else {
            s.round += 1;
            s.ballsInRound = 0;
            core.emit('round-next');
          }
        }
      } else {
        core.emit('launch-miss');
      }
    }
  },

  ports(state) {
    const s = state as any;
    return [
      { label: '始動口', on: s.phase === 'NORMAL' },
      { label: '羽根／V', on: s.haneOpen || s.phase === 'JACKPOT' },
      { label: '役物', on: s.phase === 'JACKPOT' },
    ];
  },

  stats(state) {
    const s = state as any;
    return [
      { label: '回合', value: s.phase === 'JACKPOT' ? s.round + '/' + spec.maxRounds + 'R' : '—' },
      { label: '本回合', value: s.phase === 'JACKPOT' ? s.ballsInRound + '/' + spec.ballsPerRound : '—' },
      { label: '大當り', value: s.consecutiveWins },
    ];
  },

  guide(state) {
    const s = state as any;
    if (s.phase === 'NORMAL')
      return {
        step: 'normal',
        title: '① 通常時',
        goal: '打珠進「始動口」讓羽根張開，趁機把珠送進中央 V',
        prob: '羽根張開時 V 入賞約 1/50 → 大當り',
        hint: '沒有數字盤，全靠珠物理進 V。打法：通常打。',
      };
    return {
      step: 'round',
      title: '② 大當り（' + s.round + 'R）',
      goal: '趁羽根連續開閉吃出玉，並讓珠再進 V 以繼續',
      prob: '每回合 V 再入賞 ~60% 續行，最多 ' + spec.maxRounds + 'R',
      hint: '出玉較少但穩定。打法：右打。',
    };
  },

  flow: [
    { no: '①', id: 'normal', title: '通常時', dir: '通常打', desc: '珠進始動口 → 羽根張開（沒有數字盤）' },
    { arrow: '↓ 珠進 V（約 1/50）' },
    { no: '②', id: 'round', title: '大當り', dir: '右打', desc: '羽根連續開閉吃球。每回合 V 再入賞 ~60% 續行' },
    { arrow: '↺ 最多 15R／未再進 V → 結束回 ①' },
  ],

  describe(evt: PachinkoEvent) {
    const s = evt.state as any;
    switch (evt.type) {
      case 'chucker':
        return '珠進始動口 → 羽根張開';
      case 'v-hit':
        return '🎉 珠進 V！大當り開始 → 右打';
      case 'attacker-in':
        return '役物吃球 +' + spec.attackerReward + '（持珠 ' + s.balls + '）';
      case 'round-next':
        return 'V 再入賞！繼續（' + s.round + 'R）';
      case 'jackpot-end':
        return '--- 大當り結束 → 回通常時 ---';
      default:
        return null;
    }
  },
};

export default machine;
