/**
 * 神諭石像臉 — 展示頁用的薄包裝(demo-only)。
 * 管理「受控情緒 vs 自動循環」的切換 UI;StatueFace 本身維持純元件、可重用。
 */

import { useState } from 'react';
import StatueFace from './StatueFace';
import { EMOTIONS, EMOTION_LABELS, type Emotion } from '@/lib/face/emotions';

export default function OracleDemo() {
  // null = 自動循環;指定情緒 = 受控
  const [picked, setPicked] = useState<Emotion | null>(null);

  return (
    <div className="flex flex-col items-center gap-6">
      <StatueFace emotion={picked ?? undefined} />

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={`btn btn-sm ${picked === null ? 'btn-info' : 'btn-outline-info'}`}
          onClick={() => setPicked(null)}
        >
          🔄 自動循環
        </button>
        {EMOTIONS.map((e) => (
          <button
            key={e}
            type="button"
            className={`btn btn-sm ${picked === e ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setPicked(e)}
          >
            {EMOTION_LABELS[e]}
          </button>
        ))}
      </div>

      <p className="text-base-600 small text-center mb-0">
        移動滑鼠 — 它的眼神會跟著你 · 點一下 — 戳戳看會怎樣 · 放著別動 — 它會打起瞌睡
      </p>
    </div>
  );
}
