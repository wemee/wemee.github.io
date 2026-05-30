import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  lerpParams,
  easeInOutCubic,
  computeGeometry,
  pupilOpacity,
  teethRect,
} from './geometry';
import { EMOTION_PRESETS, CYCLE_ORDER, type AnyEmotion } from './emotions';

describe('numeric helpers', () => {
  it('clamps within range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('lerp hits both endpoints', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('easeInOutCubic is pinned at 0 and 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe('lerpParams', () => {
  it('returns the start params at t=0 and end at t=1', () => {
    const a = EMOTION_PRESETS.neutral;
    const b = EMOTION_PRESETS.happy;
    expect(lerpParams(a, b, 0)).toEqual(a);
    const end = lerpParams(a, b, 1);
    for (const k of Object.keys(b) as (keyof typeof b)[]) {
      expect(end[k]).toBeCloseTo(b[k], 10);
    }
  });

  it('does not mutate inputs', () => {
    const a = { ...EMOTION_PRESETS.neutral };
    const b = { ...EMOTION_PRESETS.angry };
    const snapshot = { ...a };
    lerpParams(a, b, 0.3);
    expect(a).toEqual(snapshot);
  });
});

describe('EMOTION_PRESETS coverage', () => {
  const all: AnyEmotion[] = [
    'neutral',
    'happy',
    'angry',
    'sad',
    'surprised',
    'suspicious',
    'speaking',
    'sleepy',
    'yawn',
  ];

  it('defines every emotion with all 13 params', () => {
    for (const e of all) {
      const p = EMOTION_PRESETS[e];
      expect(p, e).toBeDefined();
      expect(Object.keys(p).length).toBe(13);
    }
  });

  it('cycle order only references defined presets', () => {
    for (const e of CYCLE_ORDER) {
      expect(EMOTION_PRESETS[e]).toBeDefined();
    }
  });
});

describe('computeGeometry', () => {
  it('produces valid path strings for every preset', () => {
    for (const e of CYCLE_ORDER) {
      const g = computeGeometry(EMOTION_PRESETS[e]);
      for (const d of [g.leftEye, g.rightEye, g.leftBrow, g.rightBrow, g.mouth]) {
        expect(d.startsWith('M')).toBe(true);
        expect(d).not.toMatch(/NaN/);
      }
      expect(g.glow).toBeGreaterThanOrEqual(0);
      expect(g.glow).toBeLessThanOrEqual(1);
    }
  });

  it('fades pupils as the eye closes', () => {
    expect(pupilOpacity({ ...EMOTION_PRESETS.neutral, eyeOpenness: 0 })).toBe(0);
    expect(pupilOpacity({ ...EMOTION_PRESETS.neutral, eyeOpenness: 1 })).toBe(1);
  });

  it('only shows teeth when gritting with an open mouth', () => {
    expect(teethRect(EMOTION_PRESETS.neutral)).toBeNull();
    expect(teethRect(EMOTION_PRESETS.angry)).not.toBeNull();
  });
});
