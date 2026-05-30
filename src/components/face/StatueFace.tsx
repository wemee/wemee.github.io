/**
 * 神諭石像臉(Oracle Statue Face)— 畫面層(React)
 *
 * 職責只有「畫出 SVG + 接線」:渲染石雕 moai 與五官、把元素 ref 交給
 * FaceRigController、用既有的 useGameLoop 每幀驅動、轉送 pointer/click。
 * 所有動畫狀態與幾何都在 lib/face/* 三層,這裡不放邏輯。
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import useGameLoop from '@/hooks/useGameLoop';
import { FaceRigController, type FaceRefs } from '@/lib/face/FaceRigController';
import type { Emotion } from '@/lib/face/emotions';
import './statue-face.css';

interface StatueFaceProps {
  /** 受控情緒:給定則固定顯示並停用自動循環。 */
  emotion?: Emotion;
  /** 是否自動循環情緒(預設 true)。 */
  autoCycle?: boolean;
  /** 每種情緒停留秒數(預設 4)。 */
  dwellSeconds?: number;
  /** 瞳孔是否跟隨游標(預設 true)。 */
  gazeTracking?: boolean;
  /** 點/戳是否觸發反應(預設 true)。 */
  reactOnPoke?: boolean;
}

// moai 頭部輪廓(viewBox 0 0 400 480)
const HEAD_PATH =
  'M 108,96 Q 200,34 292,96 L 304,250 Q 308,362 268,420 ' +
  'Q 200,472 132,420 Q 92,362 96,250 Z';

// 寬鼻(靜態)
const NOSE_PATH = 'M 186,206 L 178,298 Q 178,316 200,318 Q 222,316 222,298 L 214,206 Z';

// 低多邊形碎面(裝飾,clip 在頭內)。alt 旗標換填色製造碎面明暗。
const FACETS: { points: string; alt?: boolean }[] = [
  { points: '108,96 200,40 200,150' },
  { points: '292,96 200,40 200,150', alt: true },
  { points: '108,96 200,150 110,250', alt: true },
  { points: '292,96 200,150 296,250' },
  { points: '110,250 200,150 200,330' },
  { points: '296,250 200,150 200,330', alt: true },
  { points: '110,250 200,330 132,420', alt: true },
  { points: '296,250 200,330 268,420' },
  { points: '132,420 200,330 200,460' },
  { points: '268,420 200,330 200,460', alt: true },
  { points: '108,96 110,250 96,250' },
  { points: '292,96 296,250 304,250', alt: true },
];

// 背景星光:用固定 seed 產生(避免 SSR/CSR hydration 不一致)
function makeStars(count: number) {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: count }, () => ({
    cx: Math.round(rand() * 400),
    cy: Math.round(rand() * 480),
    r: 0.6 + rand() * 1.6,
    dur: (2.5 + rand() * 4).toFixed(2),
    delay: (rand() * 4).toFixed(2),
  }));
}
const STARS = makeStars(34);

export default function StatueFace({
  emotion,
  autoCycle = true,
  dwellSeconds = 4,
  gazeTracking = true,
  reactOnPoke = true,
}: StatueFaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const controllerRef = useRef<FaceRigController | null>(null);

  // 五官 / 群組 refs
  const leftEye = useRef<SVGPathElement>(null);
  const rightEye = useRef<SVGPathElement>(null);
  const leftPupil = useRef<SVGCircleElement>(null);
  const rightPupil = useRef<SVGCircleElement>(null);
  const leftBrow = useRef<SVGPathElement>(null);
  const rightBrow = useRef<SVGPathElement>(null);
  const mouth = useRef<SVGPathElement>(null);
  const teeth = useRef<SVGRectElement>(null);
  const tear = useRef<SVGPathElement>(null);
  const floatGroup = useRef<SVGGElement>(null);
  const glow = useRef<SVGEllipseElement>(null);

  // 建立控制器(在 useGameLoop 的 autoStart effect 之前)
  useLayoutEffect(() => {
    const refs: FaceRefs = {
      leftEye: leftEye.current!,
      rightEye: rightEye.current!,
      leftPupil: leftPupil.current!,
      rightPupil: rightPupil.current!,
      leftBrow: leftBrow.current!,
      rightBrow: rightBrow.current!,
      mouth: mouth.current!,
      teeth: teeth.current!,
      tear: tear.current!,
      floatGroup: floatGroup.current!,
      glow: glow.current!,
    };
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const controller = new FaceRigController(refs, {
      autoCycle: emotion ? false : autoCycle,
      dwellSeconds,
      gazeTracking,
      reactOnPoke,
      reducedMotion: reduced,
    });
    if (emotion) controller.setControlled(emotion);
    controllerRef.current = controller;

    // 監聽 reduced-motion 變化
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = (e: MediaQueryListEvent) =>
      controller.setConfig({ reducedMotion: e.matches });
    mq.addEventListener('change', onMq);

    return () => {
      mq.removeEventListener('change', onMq);
      controller.destroy();
      controllerRef.current = null;
    };
    // 僅建立一次;後續 props 變化由下方 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // props 變化 → 同步設定
  useEffect(() => {
    const c = controllerRef.current;
    if (!c) return;
    c.setControlled(emotion ?? null);
    c.setConfig({
      autoCycle: emotion ? false : autoCycle,
      dwellSeconds,
      gazeTracking,
      reactOnPoke,
    });
  }, [emotion, autoCycle, dwellSeconds, gazeTracking, reactOnPoke]);

  // rAF 驅動(重用既有 hook);分頁隱藏時暫停
  const loop = useGameLoop({
    onTick: (dt) => controllerRef.current?.tick(dt),
    autoStart: true,
    targetFps: 60,
  });
  useEffect(() => {
    const onVis = () => (document.hidden ? loop.pause() : loop.resume());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loop]);

  // pointer → 注視方向(以 SVG 中心為原點,正規化 -1..1)
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const c = controllerRef.current;
    const svg = svgRef.current;
    if (!c || !svg) return;
    const rect = svg.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    c.setGaze(nx, ny);
  };
  const handlePointerLeave = () => controllerRef.current?.setGaze(0, 0);
  const handlePoke = () => controllerRef.current?.poke();

  const stars = useMemo(() => STARS, []);

  return (
    <div className="oracle-stage">
      <svg
        ref={svgRef}
        className="oracle-face"
        viewBox="0 0 400 480"
        role="img"
        aria-label="會表情的神祕石像臉"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePoke}
      >
        <defs>
          <radialGradient id="oracleStone" cx="42%" cy="34%" r="80%">
            <stop offset="0%" stopColor="var(--color-base-600)" />
            <stop offset="55%" stopColor="var(--color-base-800)" />
            <stop offset="100%" stopColor="var(--color-base-900)" />
          </radialGradient>
          <radialGradient id="oracleHalo" cx="50%" cy="46%" r="55%">
            <stop offset="0%" stopColor="var(--color-accent-cyan)" stopOpacity="0.55" />
            <stop offset="60%" stopColor="var(--color-accent-blue)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-accent-blue)" stopOpacity="0" />
          </radialGradient>
          <clipPath id="oracleHeadClip">
            <path d={HEAD_PATH} />
          </clipPath>
          <filter id="oracleGrain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id="oracleEyeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 背景星光(在漂浮群組外,保持靜止參考) */}
        <g aria-hidden="true">
          {stars.map((s, i) => (
            <circle
              key={i}
              className="oracle-star"
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              style={
                {
                  '--twinkle-dur': `${s.dur}s`,
                  '--twinkle-delay': `${s.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        {/* 漂浮群組:整顆頭 + 輝光 */}
        <g ref={floatGroup} className="oracle-float">
          <ellipse
            ref={glow}
            className="oracle-glow"
            cx={200}
            cy={235}
            rx={185}
            ry={210}
            fill="url(#oracleHalo)"
          />

          {/* 石材頭部 */}
          <path className="oracle-stone" d={HEAD_PATH} />

          {/* 低多邊形碎面 + 顆粒(clip 在頭內) */}
          <g clipPath="url(#oracleHeadClip)">
            {FACETS.map((f, i) => (
              <polygon
                key={i}
                className={f.alt ? 'oracle-facet alt' : 'oracle-facet'}
                points={f.points}
              />
            ))}
            <rect
              className="oracle-grain"
              x={0}
              y={0}
              width={400}
              height={480}
              filter="url(#oracleGrain)"
            />
          </g>

          {/* 寬鼻(靜態) */}
          <path className="oracle-nose" d={NOSE_PATH} />

          {/* 眉毛(初始 d 由控制器立即覆寫) */}
          <path ref={leftBrow} className="oracle-brow" d="" />
          <path ref={rightBrow} className="oracle-brow" d="" />

          {/* 眼睛 + 瞳孔(瞳孔群組套發光 filter) */}
          <path ref={leftEye} className="oracle-eye" d="" />
          <path ref={rightEye} className="oracle-eye" d="" />
          <g filter="url(#oracleEyeGlow)">
            <circle ref={leftPupil} className="oracle-pupil" />
            <circle ref={rightPupil} className="oracle-pupil" />
          </g>

          {/* 嘴 + 牙列 */}
          <path ref={mouth} className="oracle-mouth" d="" />
          <rect ref={teeth} className="oracle-teeth" rx={3} />

          {/* 眼淚 */}
          <path ref={tear} className="oracle-tear" d="" />
        </g>
      </svg>
    </div>
  );
}
