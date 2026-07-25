/**
 * 停車記錄器的純邏輯層：距離計算、時間格式化、日期分組、地圖連結。
 * 不碰 DOM、不碰 localStorage，方便測試。
 */

export interface ParkingRecord {
    id: string;
    lat: number;
    lng: number;
    /** 定位誤差半徑（公尺） */
    accuracy: number;
    /** epoch milliseconds */
    timestamp: number;
    /** 使用者自填的備註，未填為空字串 */
    label: string;
}

export interface Coords {
    lat: number;
    lng: number;
}

/** 超過這個誤差就提醒使用者定位可能不準（地下停車場常見） */
export const POOR_ACCURACY_M = 50;

/** 取樣時只要精度好到這個程度就提早結束，不用等滿 5 秒 */
export const GOOD_ACCURACY_M = 10;

/** 取樣時間上限（毫秒） */
export const SAMPLE_DURATION_MS = 5000;

/** 最多保留幾筆記錄，超過就丟掉最舊的 */
export const MAX_RECORDS = 100;

const EARTH_RADIUS_M = 6371008.8;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** 兩點間的大圓距離（公尺） */
export function haversineDistance(a: Coords, b: Coords): number {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 把公尺數講成人話：120 公尺 / 1.4 公里 */
export function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} 公尺`;
    return `${(meters / 1000).toFixed(1)} 公里`;
}

/** 誤差半徑顯示成 ±8m */
export function formatAccuracy(meters: number): string {
    return `±${Math.round(meters)}m`;
}

/** 24 小時制的 HH:MM */
export function formatClock(timestamp: number): string {
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/** 相對時間：剛剛 / 12 分鐘前 / 3 小時前 / 2 天前 */
export function formatRelativeTime(timestamp: number, now: number): string {
    const diffMs = Math.max(0, now - timestamp);
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return '剛剛';
    if (minutes < 60) return `${minutes} 分鐘前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小時前`;

    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 用當地時區把時間點壓成 YYYY-MM-DD，當作分組的 key */
export function toDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/** 分組標題：今天 / 昨天 / 07/23（週三） */
export function formatDateHeading(timestamp: number, now: number): string {
    const key = toDateKey(timestamp);
    if (key === toDateKey(now)) return '今天';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === toDateKey(yesterday.getTime())) return '昨天';

    const d = new Date(timestamp);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}（週${WEEKDAYS[d.getDay()]}）`;
}

export interface RecordGroup {
    key: string;
    heading: string;
    records: ParkingRecord[];
}

/** 依日期分組，日期新到舊、組內也是新到舊 */
export function groupByDate(records: ParkingRecord[], now: number): RecordGroup[] {
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
    const groups: RecordGroup[] = [];

    for (const record of sorted) {
        const key = toDateKey(record.timestamp);
        const last = groups[groups.length - 1];

        if (last && last.key === key) {
            last.records = [...last.records, record];
            continue;
        }

        groups.push({
            key,
            heading: formatDateHeading(record.timestamp, now),
            records: [record],
        });
    }

    return groups;
}

/** Google Maps 官方 URL API：在地圖上標出這個座標 */
export function googleMapsSearchUrl({ lat, lng }: Coords): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Google Maps 官方 URL API：從目前位置步行導航過去 */
export function googleMapsWalkUrl({ lat, lng }: Coords): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

/** 座標文字，取到小數 6 位（約 0.1 公尺），方便複製貼上 */
export function formatCoords({ lat, lng }: Coords): string {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** 存檔前的清理：新到舊排序並砍到上限 */
export function trimRecords(records: ParkingRecord[]): ParkingRecord[] {
    return [...records]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_RECORDS);
}

/** 從 localStorage 讀出來的東西不能信，逐筆驗過 */
export function parseRecords(raw: unknown): ParkingRecord[] {
    if (!Array.isArray(raw)) return [];

    return raw.filter((item): item is ParkingRecord => {
        if (!item || typeof item !== 'object') return false;
        const r = item as Record<string, unknown>;
        return (
            typeof r.id === 'string' &&
            typeof r.lat === 'number' &&
            Number.isFinite(r.lat) &&
            typeof r.lng === 'number' &&
            Number.isFinite(r.lng) &&
            typeof r.accuracy === 'number' &&
            typeof r.timestamp === 'number' &&
            typeof r.label === 'string'
        );
    });
}
