import { describe, it, expect } from 'vitest';
import { findSafeWindows, nextSafeWindow, findNextCategoryCrossing, classifyAqiCategory, type AQIWindowPoint } from './aqiWindows.js';

const BASE = new Date('2026-07-21T00:00:00Z');
const hour = (n: number): Date => new Date(BASE.getTime() + n * 3_600_000);

function series(values: number[]): AQIWindowPoint[] {
    return values.map((usAqi, i) => ({ timestamp: hour(i), usAqi }));
}

describe('findSafeWindows', () => {
    it('returns no windows for an empty series', () => {
        expect(findSafeWindows([], 100, hour(0))).toEqual([]);
    });

    it('returns one window spanning the whole series when everything is safe', () => {
        const windows = findSafeWindows(series([40, 50, 60, 55]), 100, hour(0));
        expect(windows).toHaveLength(1);
        expect(windows[0].start).toEqual(hour(0));
        expect(windows[0].end).toEqual(hour(3));
        expect(windows[0].durationHours).toBe(3);
    });

    it('returns no windows when everything is above threshold', () => {
        expect(findSafeWindows(series([150, 160, 170]), 100, hour(0))).toEqual([]);
    });

    it('splits into separate windows around a sustained unsafe stretch', () => {
        const windows = findSafeWindows(series([50, 60, 200, 210, 220, 55, 60]), 100, hour(0));
        expect(windows).toHaveLength(2);
        expect(windows[0].start).toEqual(hour(0));
        expect(windows[0].end).toEqual(hour(1));
        expect(windows[1].start).toEqual(hour(5));
        expect(windows[1].end).toEqual(hour(6));
    });

    it('tolerates a single-hour spike and merges the window across it', () => {
        const windows = findSafeWindows(series([50, 60, 110, 55, 58]), 100, hour(0));
        expect(windows).toHaveLength(1);
        expect(windows[0].start).toEqual(hour(0));
        expect(windows[0].end).toEqual(hour(4));
        // avg excludes the spike, max reflects it honestly
        expect(windows[0].maxAqi).toBe(110);
        expect(windows[0].avgAqi).toBeLessThan(100);
    });

    it('does not tolerate a spike longer than the gap tolerance', () => {
        const windows = findSafeWindows(series([50, 60, 110, 120, 55, 58]), 100, hour(0));
        expect(windows).toHaveLength(2);
        expect(windows[0].end).toEqual(hour(1));
        expect(windows[1].start).toEqual(hour(4));
    });

    it('does not extend a window past the last safe point when the series ends mid-tolerance', () => {
        const windows = findSafeWindows(series([50, 60, 110]), 100, hour(0));
        expect(windows).toHaveLength(1);
        expect(windows[0].end).toEqual(hour(1)); // trailing tolerated spike not counted as safe duration
    });

    it('marks a window as current when "now" falls inside it', () => {
        const windows = findSafeWindows(series([50, 60, 55, 58]), 100, hour(1.5));
        expect(windows[0].isCurrent).toBe(true);
    });

    it('does not mark a future window as current', () => {
        const windows = findSafeWindows(series([200, 50, 60]), 100, hour(0));
        expect(windows[0].isCurrent).toBe(false);
    });

    it('respects a custom gap tolerance', () => {
        const windows = findSafeWindows(series([50, 60, 110, 120, 55, 58]), 100, hour(0), 2);
        expect(windows).toHaveLength(1); // 2-hour spike now tolerated
    });
});

describe('nextSafeWindow', () => {
    it('returns null when there are no windows', () => {
        expect(nextSafeWindow([], hour(0))).toBeNull();
    });

    it('prefers the current window over a later one', () => {
        const windows = findSafeWindows(series([50, 200, 60, 65]), 100, hour(0));
        const next = nextSafeWindow(windows, hour(0));
        expect(next?.isCurrent).toBe(true);
        expect(next?.start).toEqual(hour(0));
    });

    it('returns the soonest upcoming window when not currently in one', () => {
        const windows = findSafeWindows(series([200, 210, 50, 60, 220, 40, 45]), 100, hour(0));
        const next = nextSafeWindow(windows, hour(0));
        expect(next?.start).toEqual(hour(2));
    });

    it('returns null when currently unsafe and no future safe window exists', () => {
        const windows = findSafeWindows(series([200, 210, 220]), 100, hour(0));
        expect(nextSafeWindow(windows, hour(0))).toBeNull();
    });
});

describe('classifyAqiCategory', () => {
    it('matches the boundaries used by getAQIRisk', () => {
        expect(classifyAqiCategory(0)).toBe('Good');
        expect(classifyAqiCategory(50)).toBe('Good');
        expect(classifyAqiCategory(51)).toBe('Moderate');
        expect(classifyAqiCategory(99)).toBe('Moderate');
        expect(classifyAqiCategory(100)).toBe('Unhealthy for Sensitive Groups');
        expect(classifyAqiCategory(149)).toBe('Unhealthy for Sensitive Groups');
        expect(classifyAqiCategory(150)).toBe('Unhealthy');
        expect(classifyAqiCategory(199)).toBe('Unhealthy');
        expect(classifyAqiCategory(200)).toBe('Very Unhealthy');
        expect(classifyAqiCategory(400)).toBe('Very Unhealthy');
    });
});

describe('findNextCategoryCrossing', () => {
    it('returns null when nothing in the forecast is worse than now', () => {
        const future = series([40, 45, 50, 42]).map(p => ({ timestamp: p.timestamp, usAqi: p.usAqi }));
        expect(findNextCategoryCrossing(40, future, hour(-1))).toBeNull();
    });

    it('finds the first future point that crosses into a worse category', () => {
        const future = [
            { timestamp: hour(1), usAqi: 45 },  // still Good
            { timestamp: hour(2), usAqi: 60 },  // crosses into Moderate
            { timestamp: hour(3), usAqi: 120 }, // crosses further into Unhealthy for Sensitive Groups
        ];
        const result = findNextCategoryCrossing(40, future, hour(0));
        expect(result?.toCategory).toBe('Moderate');
        expect(result?.at).toEqual(hour(2));
        expect(result?.fromCategory).toBe('Good');
    });

    it('ignores past rows even if included in the input array', () => {
        const rows = [
            { timestamp: hour(-1), usAqi: 300 }, // in the past -- must be ignored
            { timestamp: hour(1), usAqi: 40 },
        ];
        expect(findNextCategoryCrossing(40, rows, hour(0))).toBeNull();
    });

    it('does not report an improving crossing', () => {
        const future = [
            { timestamp: hour(1), usAqi: 60 },  // Moderate -- same or better than current
            { timestamp: hour(2), usAqi: 40 },  // improves to Good
        ];
        // current is already Moderate (60) -- nothing here is worse than Moderate
        expect(findNextCategoryCrossing(65, future, hour(0))).toBeNull();
    });

    it('skips a same-category point and reports the first genuinely worse one', () => {
        const future = [
            { timestamp: hour(1), usAqi: 55 },  // still Moderate, same as current -- not a crossing
            { timestamp: hour(2), usAqi: 105 }, // crosses into Unhealthy for Sensitive Groups
        ];
        const result = findNextCategoryCrossing(52, future, hour(0));
        expect(result?.at).toEqual(hour(2));
        expect(result?.toCategory).toBe('Unhealthy for Sensitive Groups');
    });
});
