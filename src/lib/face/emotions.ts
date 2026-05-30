/**
 * 神諭石像臉 — 情緒預設(資料層)
 *
 * 五官形狀由一組數值參數(FaceParams)決定;每種情緒就是這組參數的一份設定。
 * 切換情緒時在兩份設定之間做補間(見 geometry.ts 的 lerpParams),
 * 平滑變形、混合情緒、對嘴、眼神跟隨全部從同一套參數長出來。
 *
 * 這一層「只有資料」,不含任何 DOM 或繪圖邏輯。
 */

/** 臉部骨架參數。值域皆為正規化(normalized),與實際座標無關。 */
export interface FaceParams {
  /** 眼睛張開程度 0=閉(眨眼) … 1=圓睜 */
  eyeOpenness: number;
  /** 眼形弧度 -1=下垂∪(哀) … 0=平 … +1=上拱∩(笑眼) */
  eyeCurve: number;
  /** 內側眉端 y 位移:正=下壓(怒) … 負=上揚(哀) */
  browInner: number;
  /** 外側眉端 y 位移:正=下壓 … 負=上揚 */
  browOuter: number;
  /** 整體眉抬高:正=抬高(驚) … 負=下壓 */
  browRaise: number;
  /** 嘴角弧度 -1=下垂(哀/怒) … 0=平 … +1=上揚(笑) */
  mouthCurve: number;
  /** 嘴巴張開 0=閉 … 1=張開(說話用) */
  mouthOpen: number;
  /** 瞳孔注視方向 X -1=左 … +1=右(由控制器寫入,預設留 0) */
  gazeX: number;
  /** 瞳孔注視方向 Y -1=上 … +1=下(由控制器寫入,預設留 0) */
  gazeY: number;
  /** 眼淚 0..1(哀) */
  tear: number;
  /** 咬牙 0..1(顯示牙列) */
  grit: number;
  /** 不對稱 0..1:右眉額外挑高、左眼瞇起(疑) */
  asymmetry: number;
  /** 輝光強度 0..1(氛圍與眼睛發光) */
  glow: number;
}

/** 對外的情緒種類(可手動切換 / 自動循環)。 */
export type Emotion =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'surprised'
  | 'suspicious'
  | 'speaking';

/** 內部待機情緒(久置時由控制器觸發,不列入對外 API)。 */
export type IdleEmotion = 'sleepy' | 'yawn';

export type AnyEmotion = Emotion | IdleEmotion;

/** 中性基準:其餘預設以此為底覆寫,確保每個欄位都有值。 */
const BASE: FaceParams = {
  eyeOpenness: 0.62,
  eyeCurve: 0,
  browInner: 0,
  browOuter: 0,
  browRaise: 0,
  mouthCurve: 0,
  mouthOpen: 0.05,
  gazeX: 0,
  gazeY: 0,
  tear: 0,
  grit: 0,
  asymmetry: 0,
  glow: 0.4,
};

const preset = (overrides: Partial<FaceParams>): FaceParams => ({ ...BASE, ...overrides });

export const EMOTION_PRESETS: Record<AnyEmotion, FaceParams> = {
  // 沉思 / 神祕
  neutral: preset({}),

  // 喜:笑眼上拱、眉微抬、嘴角大幅上揚
  happy: preset({
    eyeOpenness: 0.5,
    eyeCurve: 0.85,
    browRaise: 0.3,
    mouthCurve: 0.9,
    mouthOpen: 0.22,
    glow: 0.7,
  }),

  // 怒:圓睜、內眉下壓、嘴角下垂、咬牙、紅光
  angry: preset({
    eyeOpenness: 0.88,
    eyeCurve: -0.2,
    browInner: 0.9,
    browOuter: -0.25,
    browRaise: -0.35,
    mouthCurve: -0.7,
    mouthOpen: 0.12,
    grit: 0.65,
    glow: 0.95,
  }),

  // 哀:垂眼、內眉上揚(八字眉)、嘴角下垂、眼淚
  sad: preset({
    eyeOpenness: 0.45,
    eyeCurve: -0.7,
    browInner: -0.6,
    browOuter: 0.1,
    browRaise: 0.1,
    mouthCurve: -0.6,
    mouthOpen: 0,
    tear: 0.9,
    glow: 0.3,
  }),

  // 驚:圓睜到底、眉高抬、嘴大張
  surprised: preset({
    eyeOpenness: 1,
    eyeCurve: 0.1,
    browRaise: 0.95,
    mouthCurve: 0,
    mouthOpen: 0.85,
    glow: 0.85,
  }),

  // 疑:瞇眼、不對稱挑眉、嘴角微撇
  suspicious: preset({
    eyeOpenness: 0.42,
    eyeCurve: -0.1,
    browInner: 0.2,
    browRaise: 0.15,
    asymmetry: 1,
    mouthCurve: -0.2,
    mouthOpen: 0,
    glow: 0.5,
  }),

  // 訴說:半開眼、嘴微揚,mouthOpen 由控制器隨節奏調變
  speaking: preset({
    eyeOpenness: 0.6,
    eyeCurve: 0.1,
    browRaise: 0.1,
    mouthCurve: 0.2,
    mouthOpen: 0.5,
    glow: 0.6,
  }),

  // 想睡(久置):瞇眼下垂、眉微壓、暗光
  sleepy: preset({
    eyeOpenness: 0.15,
    eyeCurve: -0.3,
    browRaise: -0.2,
    mouthCurve: -0.05,
    mouthOpen: 0.1,
    glow: 0.2,
  }),

  // 打哈欠(久置):眼瞇、眉抬、嘴大張
  yawn: preset({
    eyeOpenness: 0.1,
    eyeCurve: -0.4,
    browRaise: 0.3,
    mouthCurve: 0,
    mouthOpen: 1,
    glow: 0.25,
  }),
};

/** 自動循環順序。 */
export const CYCLE_ORDER: Emotion[] = [
  'neutral',
  'happy',
  'suspicious',
  'surprised',
  'angry',
  'sad',
  'speaking',
];

/** 對外情緒清單(供 UI 產生按鈕)。 */
export const EMOTIONS: Emotion[] = [...CYCLE_ORDER];

/** 戳一下時的隨機反應情緒。 */
export const POKE_REACTIONS: Emotion[] = ['surprised', 'angry'];

/** 各情緒的中文標籤(zh-TW)。 */
export const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: '沉思',
  happy: '喜',
  angry: '怒',
  sad: '哀',
  surprised: '驚',
  suspicious: '疑',
  speaking: '訴說',
};
