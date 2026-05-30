/**
 * 神諭石像臉 — 動畫引擎(命令式狀態層)
 *
 * 持有 current / transition 兩份參數狀態,每幀朝目標補間,並直接寫入
 * 傳入的 SVG 元素(避免每幀觸發 React re-render)。同時負責待機生命感
 * (眨眼、漂浮、輝光脈動、久置想睡)與互動(瞳孔跟隨、戳一下反應)。
 *
 * 畫面層(StatueFace.tsx)只負責:畫出 SVG、把元素 ref 交進來、用既有的
 * useGameLoop 每幀呼叫 tick(dt)、轉送 pointer/click 事件。
 */

import {
  CYCLE_ORDER,
  EMOTION_PRESETS,
  POKE_REACTIONS,
  type AnyEmotion,
  type Emotion,
  type FaceParams,
} from './emotions';
import { computeGeometry, easeInOutCubic, lerpParams } from './geometry';

/** 控制器需要操作的 SVG 元素參考。 */
export interface FaceRefs {
  leftEye: SVGPathElement;
  rightEye: SVGPathElement;
  leftPupil: SVGCircleElement;
  rightPupil: SVGCircleElement;
  leftBrow: SVGPathElement;
  rightBrow: SVGPathElement;
  mouth: SVGPathElement;
  teeth: SVGRectElement;
  tear: SVGPathElement;
  /** 套用漂浮 transform 的群組。 */
  floatGroup: SVGGElement;
  /** 輝光 halo,透過 opacity 脈動。 */
  glow: SVGElement;
}

export interface FaceRigConfig {
  autoCycle: boolean;
  dwellSeconds: number;
  gazeTracking: boolean;
  reactOnPoke: boolean;
  reducedMotion: boolean;
}

const DEFAULT_CONFIG: FaceRigConfig = {
  autoCycle: true,
  dwellSeconds: 4,
  gazeTracking: true,
  reactOnPoke: true,
  reducedMotion: false,
};

const TRANSITION_MS = 420; // 情緒過渡時長(300–500ms 區間)
const BLINK_MS = 140;
const POKE_HOLD_MS = 1300;
const IDLE_SLEEPY_MS = 15_000; // 久置 15s → 想睡
const IDLE_YAWN_PERIOD_MS = 7_000; // 想睡後每 7s 打一次哈欠

export class FaceRigController {
  private refs: FaceRefs;
  private config: FaceRigConfig;

  // 參數補間狀態
  private current: FaceParams;
  private from: FaceParams;
  private to: FaceParams;
  private transElapsed = TRANSITION_MS;

  // 情緒狀態機
  private desired: AnyEmotion = 'neutral';
  private lastSet: AnyEmotion | null = null;
  private controlled: Emotion | null = null;
  private cycleIdx = 0;
  private cycleTimer = 0;

  // 戳反應
  private pokeUntil = 0;
  private pokeEmotion: Emotion = 'surprised';

  // 待機 / 時鐘
  private clock = 0;
  private lastInteractAt = 0;
  private idleClock = 0;

  // 眨眼
  private nextBlinkIn = this.randomBlinkGap();
  private blinking = false;
  private blinkElapsed = 0;

  // 瞳孔注視
  private gazeTargetX = 0;
  private gazeTargetY = 0;
  private gazeX = 0;
  private gazeY = 0;

  constructor(refs: FaceRefs, config: Partial<FaceRigConfig> = {}) {
    this.refs = refs;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.current = { ...EMOTION_PRESETS.neutral };
    this.from = { ...this.current };
    this.to = { ...this.current };
    this.lastInteractAt = performance.now();
    this.draw(); // 初始畫面
  }

  // ── 對外 API ────────────────────────────────────────────

  /** 受控模式:給定情緒則固定顯示並停用自動循環;傳 null 解除。 */
  setControlled(emotion: Emotion | null): void {
    this.controlled = emotion;
  }

  setConfig(partial: Partial<FaceRigConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** 瞳孔注視方向,x/y 皆 -1..1。 */
  setGaze(x: number, y: number): void {
    if (!this.config.gazeTracking) return;
    this.gazeTargetX = clampUnit(x);
    this.gazeTargetY = clampUnit(y);
    this.registerInteraction();
  }

  /** 戳一下 → 隨機驚/怒反應。 */
  poke(): void {
    if (!this.config.reactOnPoke) return;
    this.pokeEmotion =
      POKE_REACTIONS[Math.floor(Math.random() * POKE_REACTIONS.length)];
    this.pokeUntil = this.clock + POKE_HOLD_MS;
    this.registerInteraction();
  }

  /** 標記剛剛有互動(重置想睡計時)。 */
  registerInteraction(): void {
    this.lastInteractAt = performance.now();
  }

  /** 每幀更新,dt 為毫秒。 */
  tick(dt: number): void {
    this.clock += dt;
    this.advanceState(dt);
    this.advanceBlink(dt);
    this.advanceTransition(dt);
    this.advanceGaze(dt);
    this.draw();
    this.applyAmbient();
  }

  // ── 狀態機:決定 desired 情緒 ───────────────────────────

  private advanceState(dt: number): void {
    const idleMs = performance.now() - this.lastInteractAt;
    const inIdle = this.config.autoCycle && !this.controlled && idleMs > IDLE_SLEEPY_MS;

    let next: AnyEmotion;
    if (this.clock < this.pokeUntil) {
      next = this.pokeEmotion;
    } else if (this.controlled) {
      next = this.controlled;
    } else if (inIdle) {
      this.idleClock += dt;
      // 想睡為主,週期性打哈欠
      const phase = this.idleClock % IDLE_YAWN_PERIOD_MS;
      next = phase < 1200 ? 'yawn' : 'sleepy';
    } else if (this.config.autoCycle) {
      this.idleClock = 0;
      this.cycleTimer += dt;
      if (this.cycleTimer >= this.config.dwellSeconds * 1000) {
        this.cycleTimer = 0;
        this.cycleIdx = (this.cycleIdx + 1) % CYCLE_ORDER.length;
      }
      next = CYCLE_ORDER[this.cycleIdx];
    } else {
      next = this.desired; // 無循環、無受控 → 維持現狀
    }

    if (next !== this.lastSet) {
      this.transitionTo(next);
    }
    this.desired = next;
  }

  private transitionTo(emotion: AnyEmotion): void {
    this.from = { ...this.current };
    this.to = { ...EMOTION_PRESETS[emotion] };
    this.transElapsed = 0;
    this.lastSet = emotion;
  }

  private advanceTransition(dt: number): void {
    if (this.transElapsed >= TRANSITION_MS) {
      this.current = { ...this.to };
      return;
    }
    this.transElapsed += dt;
    const t = Math.min(this.transElapsed / TRANSITION_MS, 1);
    // reduced-motion:縮短手感(仍淡入,但較直接)
    const eased = this.config.reducedMotion ? t : easeInOutCubic(t);
    this.current = lerpParams(this.from, this.to, eased);
  }

  // ── 眨眼 ────────────────────────────────────────────────

  private randomBlinkGap(): number {
    return 3000 + Math.random() * 3000; // 3–6s
  }

  private advanceBlink(dt: number): void {
    if (this.config.reducedMotion) return; // 減少動態:不眨眼
    if (this.blinking) {
      this.blinkElapsed += dt;
      if (this.blinkElapsed >= BLINK_MS) {
        this.blinking = false;
        this.nextBlinkIn = this.randomBlinkGap();
      }
    } else {
      this.nextBlinkIn -= dt;
      if (this.nextBlinkIn <= 0) {
        this.blinking = true;
        this.blinkElapsed = 0;
      }
    }
  }

  /** 眨眼倍率:1=全開,接近 0=閉。 */
  private blinkFactor(): number {
    if (!this.blinking) return 1;
    const p = this.blinkElapsed / BLINK_MS; // 0..1
    return 1 - Math.sin(p * Math.PI); // 中點趨近 0
  }

  // ── 瞳孔注視平滑 ────────────────────────────────────────

  private advanceGaze(dt: number): void {
    const k = this.config.reducedMotion ? 1 : Math.min(1, dt / 120);
    this.gazeX += (this.gazeTargetX - this.gazeX) * k;
    this.gazeY += (this.gazeTargetY - this.gazeY) * k;
  }

  // ── 繪製(寫入 SVG)──────────────────────────────────────

  private draw(): void {
    // 在 current 之上疊加眨眼、注視、說話口型(不污染補間基準)
    const render: FaceParams = {
      ...this.current,
      eyeOpenness: this.current.eyeOpenness * this.blinkFactor(),
      gazeX: this.gazeX,
      gazeY: this.gazeY,
      mouthOpen: this.speakingMouth(this.current.mouthOpen),
    };

    const g = computeGeometry(render);
    const r = this.refs;

    r.leftEye.setAttribute('d', g.leftEye);
    r.rightEye.setAttribute('d', g.rightEye);
    r.leftBrow.setAttribute('d', g.leftBrow);
    r.rightBrow.setAttribute('d', g.rightBrow);
    r.mouth.setAttribute('d', g.mouth);

    setCircle(r.leftPupil, g.leftPupil);
    setCircle(r.rightPupil, g.rightPupil);
    r.leftPupil.style.opacity = String(g.pupilOpacity);
    r.rightPupil.style.opacity = String(g.pupilOpacity);

    if (g.teeth) {
      r.teeth.setAttribute('x', String(g.teeth.x));
      r.teeth.setAttribute('y', String(g.teeth.y));
      r.teeth.setAttribute('width', String(g.teeth.w));
      r.teeth.setAttribute('height', String(g.teeth.h));
      r.teeth.style.opacity = String(g.teethOpacity);
    } else {
      r.teeth.style.opacity = '0';
    }

    r.tear.setAttribute('d', g.tear.d);
    r.tear.style.opacity = String(g.tear.opacity);
  }

  /** 說話時讓嘴隨節奏開合(非說話則原值)。 */
  private speakingMouth(base: number): number {
    if (this.desired !== 'speaking') return base;
    if (this.config.reducedMotion) return 0.3;
    const flap = Math.abs(Math.sin(this.clock * 0.012)) * 0.45;
    return clamp01(0.12 + flap);
  }

  // ── 氛圍:漂浮 + 輝光(compositor-friendly)──────────────

  private applyAmbient(): void {
    if (this.config.reducedMotion) {
      this.refs.floatGroup.style.transform = '';
      this.refs.glow.style.opacity = String(0.25 + this.current.glow * 0.5);
      return;
    }
    const y = Math.sin(this.clock * 0.0016) * 5;
    const rot = Math.sin(this.clock * 0.0011) * 0.8;
    this.refs.floatGroup.style.transform = `translateY(${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;

    const pulse = Math.sin(this.clock * 0.002) * 0.08;
    this.refs.glow.style.opacity = String(
      clamp01(0.22 + this.current.glow * 0.55 + pulse),
    );
  }

  destroy(): void {
    // 目前無需移除的監聽(事件由 React 綁定),保留以對齊生命週期約定。
  }
}

// ── 私有小工具 ────────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampUnit = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

function setCircle(
  el: SVGCircleElement,
  pos: { cx: number; cy: number; r: number },
): void {
  el.setAttribute('cx', String(pos.cx));
  el.setAttribute('cy', String(pos.cy));
  el.setAttribute('r', String(pos.r));
}
