import { describe, test, expect } from 'vitest';
import {
    haversineDistance,
    formatDistance,
    formatAccuracy,
    formatClock,
    formatRelativeTime,
    formatDateHeading,
    groupByDate,
    googleMapsSearchUrl,
    googleMapsWalkUrl,
    formatCoords,
    trimRecords,
    parseRecords,
    MAX_RECORDS,
    type ParkingRecord,
} from './geo';

const makeRecord = (overrides: Partial<ParkingRecord> = {}): ParkingRecord => ({
    id: '1',
    lat: 25.033,
    lng: 121.5654,
    accuracy: 10,
    timestamp: new Date(2026, 6, 25, 14, 32).getTime(),
    label: '',
    ...overrides,
});

describe('haversineDistance', () => {
    test('returns 0 for identical points', () => {
        const point = { lat: 25.033, lng: 121.5654 };
        expect(haversineDistance(point, point)).toBe(0);
    });

    test('measures Taipei 101 to Taipei Main Station within 1% of the known 4.6km', () => {
        // Arrange
        const taipei101 = { lat: 25.0339, lng: 121.5645 };
        const mainStation = { lat: 25.0478, lng: 121.5170 };

        // Act
        const distance = haversineDistance(taipei101, mainStation);

        // Assert
        expect(distance).toBeGreaterThan(4900);
        expect(distance).toBeLessThan(5100);
    });

    test('is symmetric', () => {
        const a = { lat: 25.0339, lng: 121.5645 };
        const b = { lat: 25.0478, lng: 121.5170 };
        expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 6);
    });

    test('handles a short walk across a car park', () => {
        // 0.001 度緯度約等於 111 公尺
        const distance = haversineDistance({ lat: 25.0, lng: 121.5 }, { lat: 25.001, lng: 121.5 });
        expect(distance).toBeGreaterThan(110);
        expect(distance).toBeLessThan(112);
    });
});

describe('formatDistance', () => {
    test('uses meters below 1km', () => {
        expect(formatDistance(120.4)).toBe('120 公尺');
    });

    test('switches to kilometers at 1000m', () => {
        expect(formatDistance(1400)).toBe('1.4 公里');
    });
});

describe('formatAccuracy', () => {
    test('rounds to whole meters with a plus-minus sign', () => {
        expect(formatAccuracy(8.4)).toBe('±8m');
    });
});

describe('formatClock', () => {
    test('pads to 24-hour HH:MM', () => {
        expect(formatClock(new Date(2026, 6, 25, 9, 5).getTime())).toBe('09:05');
    });
});

describe('formatRelativeTime', () => {
    const now = new Date(2026, 6, 25, 14, 32).getTime();

    test('says 剛剛 under a minute', () => {
        expect(formatRelativeTime(now - 30_000, now)).toBe('剛剛');
    });

    test('counts minutes under an hour', () => {
        expect(formatRelativeTime(now - 12 * 60_000, now)).toBe('12 分鐘前');
    });

    test('counts hours under a day', () => {
        expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3 小時前');
    });

    test('counts days beyond 24 hours', () => {
        expect(formatRelativeTime(now - 50 * 3_600_000, now)).toBe('2 天前');
    });

    test('never reports negative time when the clock drifts', () => {
        expect(formatRelativeTime(now + 60_000, now)).toBe('剛剛');
    });
});

describe('formatDateHeading', () => {
    const now = new Date(2026, 6, 25, 14, 0).getTime();

    test('labels the current calendar day as 今天', () => {
        expect(formatDateHeading(new Date(2026, 6, 25, 1, 0).getTime(), now)).toBe('今天');
    });

    test('labels the previous calendar day as 昨天', () => {
        expect(formatDateHeading(new Date(2026, 6, 24, 23, 0).getTime(), now)).toBe('昨天');
    });

    test('falls back to date with weekday', () => {
        // 2026-07-22 is a Wednesday
        expect(formatDateHeading(new Date(2026, 6, 22, 8, 0).getTime(), now)).toBe('07/22（週三）');
    });

    test('crosses a month boundary correctly', () => {
        const firstOfAugust = new Date(2026, 7, 1, 10, 0).getTime();
        expect(formatDateHeading(new Date(2026, 6, 31, 22, 0).getTime(), firstOfAugust)).toBe('昨天');
    });
});

describe('groupByDate', () => {
    const now = new Date(2026, 6, 25, 20, 0).getTime();

    test('groups records by calendar day, newest first', () => {
        // Arrange
        const morning = makeRecord({ id: 'a', timestamp: new Date(2026, 6, 25, 9, 15).getTime() });
        const afternoon = makeRecord({ id: 'b', timestamp: new Date(2026, 6, 25, 14, 32).getTime() });
        const yesterday = makeRecord({ id: 'c', timestamp: new Date(2026, 6, 24, 18, 40).getTime() });

        // Act
        const groups = groupByDate([morning, yesterday, afternoon], now);

        // Assert
        expect(groups.map(g => g.heading)).toEqual(['今天', '昨天']);
        expect(groups[0].records.map(r => r.id)).toEqual(['b', 'a']);
        expect(groups[1].records.map(r => r.id)).toEqual(['c']);
    });

    test('returns an empty array when there are no records', () => {
        expect(groupByDate([], now)).toEqual([]);
    });

    test('does not mutate the input array', () => {
        const records = [
            makeRecord({ id: 'a', timestamp: 1 }),
            makeRecord({ id: 'b', timestamp: 2 }),
        ];
        groupByDate(records, now);
        expect(records.map(r => r.id)).toEqual(['a', 'b']);
    });
});

describe('google maps urls', () => {
    const coords = { lat: 25.033, lng: 121.5654 };

    test('search url uses the official api=1 form', () => {
        expect(googleMapsSearchUrl(coords)).toBe(
            'https://www.google.com/maps/search/?api=1&query=25.033,121.5654'
        );
    });

    test('walk url requests walking directions to the record', () => {
        expect(googleMapsWalkUrl(coords)).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=25.033,121.5654&travelmode=walking'
        );
    });
});

describe('formatCoords', () => {
    test('pads to six decimal places', () => {
        expect(formatCoords({ lat: 25.033, lng: 121.5654 })).toBe('25.033000, 121.565400');
    });
});

describe('trimRecords', () => {
    test('sorts newest first', () => {
        const records = [
            makeRecord({ id: 'old', timestamp: 100 }),
            makeRecord({ id: 'new', timestamp: 200 }),
        ];
        expect(trimRecords(records).map(r => r.id)).toEqual(['new', 'old']);
    });

    test('drops the oldest records beyond the cap', () => {
        const records = Array.from({ length: MAX_RECORDS + 5 }, (_, i) =>
            makeRecord({ id: String(i), timestamp: i })
        );

        const trimmed = trimRecords(records);

        expect(trimmed).toHaveLength(MAX_RECORDS);
        expect(trimmed[0].id).toBe(String(MAX_RECORDS + 4));
        expect(trimmed.some(r => r.id === '0')).toBe(false);
    });
});

describe('parseRecords', () => {
    test('returns an empty array for non-array input', () => {
        expect(parseRecords(null)).toEqual([]);
        expect(parseRecords({ lat: 1 })).toEqual([]);
        expect(parseRecords('nope')).toEqual([]);
    });

    test('keeps well-formed records', () => {
        const record = makeRecord();
        expect(parseRecords([record])).toEqual([record]);
    });

    test('drops records with missing or wrong-typed fields', () => {
        const good = makeRecord({ id: 'good' });
        const bad = [
            { ...makeRecord(), lat: 'x' },
            { ...makeRecord(), timestamp: undefined },
            { ...makeRecord(), label: null },
            null,
            42,
        ];
        expect(parseRecords([good, ...bad])).toEqual([good]);
    });

    test('drops records with non-finite coordinates', () => {
        expect(parseRecords([makeRecord({ lat: NaN })])).toEqual([]);
        expect(parseRecords([makeRecord({ lng: Infinity })])).toEqual([]);
    });
});
