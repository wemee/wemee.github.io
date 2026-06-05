import { useCallback, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { buttonStyles } from '@/components/ui';
import {
  CARD_BRANDS,
  generateCards,
  type CardBrand,
  type GeneratedCard,
} from '@/lib/testdata/creditCard';
import {
  generateTwIds,
  REGION_LETTERS,
  REGION_NAMES,
  type Gender,
  type GeneratedTwId,
} from '@/lib/testdata/twId';

const QUANTITIES = [1, 5, 10, 20] as const;

const selectStyles =
  'px-3 py-2 bg-base-900 border border-base-600 rounded text-base-50 focus:border-accent-blue focus:outline-none transition';

/** A copy-to-clipboard button with transient "copied" feedback. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API can fail on insecure contexts; the value is always
      // selectable on screen, so we just skip feedback.
    }
  }, [text]);

  return (
    <button
      onClick={copy}
      className="shrink-0 px-2.5 py-1 rounded text-sm border border-base-600 text-base-400 hover:text-base-50 hover:bg-base-600 transition"
      aria-label="複製"
    >
      {copied ? '✅' : '📋'}
    </button>
  );
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs text-base-500 mb-0.5">{label}</span>
      <span className={`text-base-50 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function CreditCardPanel() {
  const [brand, setBrand] = useState<CardBrand | 'random'>('random');
  const [count, setCount] = useState<number>(5);
  const [cards, setCards] = useState<GeneratedCard[]>(() => generateCards('random', 5));

  const generate = useCallback(() => {
    setCards(generateCards(brand, count));
  }, [brand, count]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-base-400">
          卡別
          <select
            className={selectStyles}
            value={brand}
            onChange={(e) => setBrand(e.target.value as CardBrand | 'random')}
          >
            <option value="random">隨機</option>
            {(Object.keys(CARD_BRANDS) as CardBrand[]).map((b) => (
              <option key={b} value={b}>
                {CARD_BRANDS[b].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-base-400">
          數量
          <select
            className={selectStyles}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {QUANTITIES.map((q) => (
              <option key={q} value={q}>
                {q} 筆
              </option>
            ))}
          </select>
        </label>
        <button className={buttonStyles.primary} onClick={generate}>
          🎲 產生
        </button>
      </div>

      <div className="space-y-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className="rounded-lg border border-base-600 bg-base-800 p-3 flex items-center gap-4"
          >
            <span className="shrink-0 w-28 text-sm text-accent-cyan font-medium">
              {CARD_BRANDS[card.brand].label}
            </span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="font-mono text-base-50 text-lg tracking-wide truncate">
                {card.numberSpaced}
              </span>
              <CopyButton text={card.number} />
            </div>
            <div className="hidden sm:flex gap-6 shrink-0">
              <Field label="到期" value={card.expShort} />
              <Field label="CVV" value={card.cvv} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TwIdPanel() {
  const [gender, setGender] = useState<Gender | 'random'>('random');
  const [region, setRegion] = useState<string>('random');
  const [count, setCount] = useState<number>(5);
  const [ids, setIds] = useState<GeneratedTwId[]>(() => generateTwIds(5));

  const generate = useCallback(() => {
    setIds(generateTwIds(count, { gender, region }));
  }, [gender, region, count]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-base-400">
          性別
          <select
            className={selectStyles}
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | 'random')}
          >
            <option value="random">隨機</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-base-400">
          登記地
          <select
            className={selectStyles}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="random">隨機</option>
            {REGION_LETTERS.map((r) => (
              <option key={r} value={r}>
                {r}・{REGION_NAMES[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-base-400">
          數量
          <select
            className={selectStyles}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {QUANTITIES.map((q) => (
              <option key={q} value={q}>
                {q} 筆
              </option>
            ))}
          </select>
        </label>
        <button className={buttonStyles.primary} onClick={generate}>
          🎲 產生
        </button>
      </div>

      <div className="space-y-2">
        {ids.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-base-600 bg-base-800 p-3 flex items-center gap-4"
          >
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="font-mono text-base-50 text-lg tracking-wide">{item.id}</span>
              <CopyButton text={item.id} />
            </div>
            <span className="shrink-0 text-sm text-base-400">
              {item.regionName}・{item.gender === 'male' ? '男' : '女'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TestDataTool() {
  return (
    <Tabs
      tabs={[
        { label: '信用卡號碼', icon: '💳', content: <CreditCardPanel /> },
        { label: '身分證字號', icon: '🪪', content: <TwIdPanel /> },
      ]}
    />
  );
}
