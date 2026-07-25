import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useGeolocationSample, type SampledPosition } from '@/hooks/useGeolocationSample';
import {
    formatAccuracy,
    formatClock,
    formatCoords,
    formatRelativeTime,
    googleMapsSearchUrl,
    googleMapsWalkUrl,
    groupByDate,
    parseRecords,
    trimRecords,
    MAX_RECORDS,
    POOR_ACCURACY_M,
    type ParkingRecord,
} from '@/lib/parking/geo';

const ParkingMap = lazy(() => import('./_ParkingMap'));

const STORAGE_KEY = 'wemee_parking_records';

/** 相對時間每半分鐘刷新一次就夠了 */
const TICK_MS = 30_000;

/** 座標存到小數 6 位（約 0.1 公尺），再多都是雜訊 */
const round6 = (value: number): number => Number(value.toFixed(6));

const createId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export default function ParkingApp() {
    const [records, setRecords] = useState<ParkingRecord[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [labelDraft, setLabelDraft] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [pendingClear, setPendingClear] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [storageError, setStorageError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());

    const { status, bestAccuracy, isSlow, error, start, dismissError } = useGeolocationSample();
    const isLocating = status === 'locating';

    // 讀取既有記錄，並預設展開最新的一筆
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            const loaded = trimRecords(parseRecords(JSON.parse(stored)));
            setRecords(loaded);
            if (loaded.length > 0) setExpandedId(loaded[0].id);
        } catch (e) {
            console.error('Failed to load parking records:', e);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(timer);
    }, []);

    const persist = useCallback((updater: (previous: ParkingRecord[]) => ParkingRecord[]) => {
        setRecords((previous) => {
            const next = trimRecords(updater(previous));
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                setStorageError(null);
            } catch (e) {
                console.error('Failed to save parking records:', e);
                setStorageError('瀏覽器的儲存空間寫入失敗，這筆記錄關掉分頁後可能會不見。');
            }
            return next;
        });
    }, []);

    const handleRecord = useCallback(() => {
        start((position: SampledPosition) => {
            const record: ParkingRecord = {
                id: createId(),
                lat: round6(position.lat),
                lng: round6(position.lng),
                accuracy: Math.round(position.accuracy),
                timestamp: Date.now(),
                label: '',
            };

            persist((previous) => [record, ...previous]);
            setNow(Date.now());
            setExpandedId(record.id);
            setPendingDeleteId(null);
        });
    }, [persist, start]);

    const toggleExpanded = useCallback((id: string) => {
        setExpandedId((current) => (current === id ? null : id));
        setPendingDeleteId(null);
        setEditingLabelId(null);
    }, []);

    const startEditingLabel = useCallback((record: ParkingRecord) => {
        setEditingLabelId(record.id);
        setLabelDraft(record.label);
    }, []);

    const saveLabel = useCallback(() => {
        const id = editingLabelId;
        if (!id) return;

        const label = labelDraft.trim();
        persist((previous) => previous.map((r) => (r.id === id ? { ...r, label } : r)));
        setEditingLabelId(null);
        setLabelDraft('');
    }, [editingLabelId, labelDraft, persist]);

    const deleteRecord = useCallback(
        (id: string) => {
            persist((previous) => previous.filter((r) => r.id !== id));
            setPendingDeleteId(null);
            setExpandedId((current) => (current === id ? null : current));
        },
        [persist]
    );

    const clearAll = useCallback(() => {
        persist(() => []);
        setPendingClear(false);
        setExpandedId(null);
    }, [persist]);

    const copyCoords = useCallback(async (record: ParkingRecord) => {
        try {
            await navigator.clipboard.writeText(formatCoords(record));
            setCopiedId(record.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            console.error('Failed to copy coordinates:', e);
        }
    }, []);

    const groups = useMemo(() => groupByDate(records, now), [records, now]);

    return (
        <div className="space-y-6">
            {/* 主要動作：停好車按這一顆，其他都是附屬品 */}
            <button
                onClick={handleRecord}
                disabled={isLocating}
                className={`w-full rounded-2xl border px-6 py-8 text-center transition
                    ${isLocating
                        ? 'border-accent-cyan bg-accent-cyan/10 cursor-wait'
                        : 'border-accent-blue bg-accent-blue/15 hover:bg-accent-blue/25 active:scale-[0.99] shadow-lg shadow-accent-blue/10'
                    }`}
            >
                <span className="block text-3xl sm:text-4xl font-bold text-base-50 tracking-tight">
                    {isLocating ? '定位中…' : '📍 記錄停車位置'}
                </span>
                <span className="mt-2 block text-sm text-base-400">
                    {!isLocating
                        ? '按一下就好，其他都不用管'
                        : bestAccuracy !== null
                            ? `目前精度 ${formatAccuracy(bestAccuracy)}，正在等更準的訊號…`
                            : isSlow
                                ? 'GPS 訊號比較弱，還在等第一筆座標，再等一下…'
                                : '正在向 GPS 要座標，大約 5 秒'}
                </span>
            </button>

            {error && (
                <div className="rounded-lg border border-accent-red bg-accent-red/20 p-4 flex items-start gap-3">
                    <span className="text-base-50">{error}</span>
                    <button
                        onClick={dismissError}
                        className="ml-auto text-base-400 hover:text-base-50 transition"
                        aria-label="關閉提示"
                    >
                        ×
                    </button>
                </div>
            )}

            {storageError && (
                <div className="rounded-lg border border-accent-yellow bg-accent-yellow/20 p-4 text-base-50">
                    {storageError}
                </div>
            )}

            {/* 記錄列表 */}
            {records.length === 0 ? (
                <div className="rounded-lg border border-dashed border-base-600 py-12 text-center">
                    <div className="text-4xl mb-3">🅿️</div>
                    <p className="text-base-400">還沒有任何記錄。</p>
                    <p className="text-base-600 text-sm mt-1">停好車，按上面那顆按鈕就好。</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groups.map((group) => (
                        <section key={group.key}>
                            <h2 className="mb-2 flex items-center gap-3 text-sm font-medium text-base-400">
                                <span className="uppercase tracking-widest">{group.heading}</span>
                                <span className="h-px flex-1 bg-base-600/50" />
                                <span className="text-base-600">{group.records.length} 筆</span>
                            </h2>

                            <ul className="space-y-2">
                                {group.records.map((record) => {
                                    const isExpanded = expandedId === record.id;
                                    const isPoor = record.accuracy > POOR_ACCURACY_M;

                                    return (
                                        <li
                                            key={record.id}
                                            className={`rounded-xl border transition ${isExpanded
                                                ? 'border-accent-cyan/60 bg-base-800'
                                                : 'border-base-600 bg-base-800/50 hover:border-base-400'
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleExpanded(record.id)}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                                                aria-expanded={isExpanded}
                                            >
                                                <span className="text-2xl font-semibold tabular-nums text-base-50">
                                                    {formatClock(record.timestamp)}
                                                </span>
                                                <span
                                                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${isPoor
                                                        ? 'bg-accent-yellow/20 text-accent-yellow'
                                                        : 'bg-base-600/40 text-base-400'
                                                        }`}
                                                    title={isPoor ? '定位誤差偏大，可能不太準' : '定位誤差'}
                                                >
                                                    {formatAccuracy(record.accuracy)}
                                                </span>
                                                {record.label && (
                                                    <span className="min-w-0 flex-1 truncate text-base-100">
                                                        {record.label}
                                                    </span>
                                                )}
                                                <span
                                                    className={`ml-auto shrink-0 text-xs text-base-600 ${record.label ? 'hidden sm:inline' : ''
                                                        }`}
                                                >
                                                    {formatRelativeTime(record.timestamp, now)}
                                                </span>
                                                <span
                                                    className={`shrink-0 text-base-600 transition-transform ${isExpanded ? 'rotate-180' : ''
                                                        }`}
                                                    aria-hidden="true"
                                                >
                                                    ▾
                                                </span>
                                            </button>

                                            {isExpanded && (
                                                <div className="space-y-3 px-4 pb-4">
                                                    <Suspense
                                                        fallback={
                                                            <div className="flex h-60 items-center justify-center rounded-lg border border-base-600 bg-base-900 text-base-600 sm:h-72">
                                                                地圖載入中…
                                                            </div>
                                                        }
                                                    >
                                                        <ParkingMap lat={record.lat} lng={record.lng} />
                                                    </Suspense>

                                                    <div className="flex flex-wrap gap-2">
                                                        <a
                                                            href={googleMapsWalkUrl(record)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="rounded bg-accent-blue px-4 py-2 font-medium text-base-50 transition hover:bg-accent-blue/80"
                                                        >
                                                            🚶 走路導航回去
                                                        </a>
                                                        <a
                                                            href={googleMapsSearchUrl(record)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="rounded border border-base-600 px-4 py-2 text-base-400 transition hover:bg-base-600 hover:text-base-50"
                                                        >
                                                            🗺️ 開啟 Google Maps
                                                        </a>
                                                        <button
                                                            onClick={() => copyCoords(record)}
                                                            className="rounded border border-base-600 px-4 py-2 text-base-400 transition hover:bg-base-600 hover:text-base-50"
                                                        >
                                                            {copiedId === record.id ? '✓ 已複製' : '📋 複製座標'}
                                                        </button>
                                                    </div>

                                                    {/* 備註：不填也完全不影響，所以預設只是一行小字 */}
                                                    {editingLabelId === record.id ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={labelDraft}
                                                                maxLength={60}
                                                                onChange={(e) => setLabelDraft(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveLabel();
                                                                    if (e.key === 'Escape') setEditingLabelId(null);
                                                                }}
                                                                placeholder="例如：B2 綠區 3-14"
                                                                className="flex-1 rounded border border-base-600 bg-base-900 px-3 py-2 text-base-50 transition placeholder:text-base-600 focus:border-accent-blue focus:outline-none"
                                                            />
                                                            <button
                                                                onClick={saveLabel}
                                                                className="rounded bg-accent-cyan px-4 py-2 font-medium text-base-900 transition hover:bg-accent-cyan/80"
                                                            >
                                                                儲存
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => startEditingLabel(record)}
                                                                className="text-sm text-base-400 transition hover:text-accent-cyan"
                                                            >
                                                                {record.label ? `📝 ${record.label}　✏️ 編輯備註` : '＋ 加備註'}
                                                            </button>

                                                            {pendingDeleteId === record.id ? (
                                                                <span className="ml-auto flex items-center gap-2 text-sm">
                                                                    <button
                                                                        onClick={() => deleteRecord(record.id)}
                                                                        className="text-accent-red hover:underline"
                                                                    >
                                                                        確定刪除
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setPendingDeleteId(null)}
                                                                        className="text-base-600 hover:text-base-400"
                                                                    >
                                                                        取消
                                                                    </button>
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setPendingDeleteId(record.id)}
                                                                    className="ml-auto text-sm text-base-600 transition hover:text-accent-red"
                                                                >
                                                                    🗑 刪除
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {records.length > 0 && (
                <div className="flex items-center justify-between border-t border-base-600 pt-4 text-sm">
                    <span className="text-base-600">
                        共 {records.length} 筆，最多保留 {MAX_RECORDS} 筆
                    </span>
                    {pendingClear ? (
                        <span className="flex items-center gap-3">
                            <button onClick={clearAll} className="text-accent-red hover:underline">
                                確定清空全部
                            </button>
                            <button
                                onClick={() => setPendingClear(false)}
                                className="text-base-600 hover:text-base-400"
                            >
                                取消
                            </button>
                        </span>
                    ) : (
                        <button
                            onClick={() => setPendingClear(true)}
                            className="text-base-600 transition hover:text-accent-red"
                        >
                            清空全部
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
