import { describe, it, expect } from 'vitest';
import { analyzeSmokeTrend, type SmokeTrendRow } from './smoke.js';

const now = Date.now();
const hoursAgo = (n: number): Date => new Date(now - n * 3600_000);
const hoursAhead = (n: number): Date => new Date(now + n * 3600_000);

function row(overrides: Partial<SmokeTrendRow> = {}): SmokeTrendRow {
    return {
        timestamp: hoursAgo(0),
        pm25: 10,
        pm10: 12,
        no2: 20,
        so2: 8,
        usAqi: 40,
        ...overrides,
    };
}

describe('analyzeSmokeTrend', () => {
    describe('missing/sparse data', () => {
        it('returns null with zero past rows', () => {
            expect(analyzeSmokeTrend([], [])).toBeNull();
        });

        it('reads as stable with exactly one past row (no lookback to compare against)', () => {
            const result = analyzeSmokeTrend([row({ pm25: 50 })], []);
            expect(result?.direction).toBe('stable');
            expect(result?.currentPm25).toBe(50);
        });

        it('falls back to the earliest available row when fewer than 7 past rows exist', () => {
            // Only 3 past rows -- lookback index clamps to index 0 (the earliest) rather
            // than throwing on an out-of-range access.
            const rows = [
                row({ timestamp: hoursAgo(2), pm25: 10 }),
                row({ timestamp: hoursAgo(1), pm25: 20 }),
                row({ timestamp: hoursAgo(0), pm25: 40 }),
            ];
            const result = analyzeSmokeTrend(rows, []);
            // delta = 40 - 10 = 30 -> worsening
            expect(result?.direction).toBe('worsening');
        });

        it('handles zero future rows without a peak (peak defaults to current)', () => {
            const result = analyzeSmokeTrend([row({ pm25: 30, usAqi: 90 })], []);
            expect(result?.next24hPeakPm25).toBe(30);
            expect(result?.next24hPeakUsAqi).toBe(90);
            expect(result?.next24hPeakAt).toBeNull();
        });
    });

    describe('boundary values (all thresholds are inclusive)', () => {
        it('PM2.5 exactly at the 20 floor counts toward a smoke signature', () => {
            const result = analyzeSmokeTrend(
                [row({ pm25: 20, pm10: 20, no2: 15, so2: 5 })],
                []
            );
            expect(result?.likelyWildfireSmoke).toBe(true);
        });

        it('PM2.5 just under the 20 floor does not', () => {
            const result = analyzeSmokeTrend(
                [row({ pm25: 19.9, pm10: 19.9, no2: 15, so2: 5 })],
                []
            );
            expect(result?.likelyWildfireSmoke).toBe(false);
        });

        it('PM2.5/PM10 ratio exactly at 0.65 counts', () => {
            const result = analyzeSmokeTrend(
                [row({ pm25: 26, pm10: 40, no2: 0, so2: 0 })], // 26/40 = 0.65
                []
            );
            expect(result?.likelyWildfireSmoke).toBe(true);
        });

        it('NO2 exactly at the 15ppb ceiling still counts; just over does not', () => {
            const atCeiling = analyzeSmokeTrend(
                [row({ pm25: 30, pm10: 30, no2: 15, so2: 0 })],
                []
            );
            expect(atCeiling?.likelyWildfireSmoke).toBe(true);

            const overCeiling = analyzeSmokeTrend(
                [row({ pm25: 30, pm10: 30, no2: 15.1, so2: 0 })],
                []
            );
            expect(overCeiling?.likelyWildfireSmoke).toBe(false);
        });

        it('SO2 exactly at the 5ppb ceiling still counts; just over does not', () => {
            const atCeiling = analyzeSmokeTrend(
                [row({ pm25: 30, pm10: 30, no2: 0, so2: 5 })],
                []
            );
            expect(atCeiling?.likelyWildfireSmoke).toBe(true);

            const overCeiling = analyzeSmokeTrend(
                [row({ pm25: 30, pm10: 30, no2: 0, so2: 5.1 })],
                []
            );
            expect(overCeiling?.likelyWildfireSmoke).toBe(false);
        });

        it('handles a zero PM10 reading without dividing by zero', () => {
            const result = analyzeSmokeTrend(
                [row({ pm25: 30, pm10: 0, no2: 0, so2: 0 })],
                []
            );
            expect(result?.likelyWildfireSmoke).toBe(false);
            expect(Number.isFinite(result!.currentPm25)).toBe(true);
        });
    });

    describe('trend noise floor', () => {
        function trendFor(deltaFromLookback: number): string | undefined {
            const rows = Array.from({ length: 7 }, (_, i) =>
                row({ timestamp: hoursAgo(6 - i), pm25: i === 6 ? 20 + deltaFromLookback : 20 })
            );
            return analyzeSmokeTrend(rows, [])?.direction;
        }

        it('a delta exactly at the 3 ug/m3 floor reads as stable (not yet "worsening")', () => {
            expect(trendFor(3)).toBe('stable');
        });

        it('a delta just over the floor reads as worsening', () => {
            expect(trendFor(3.1)).toBe('worsening');
        });

        it('a delta exactly at the negative floor reads as stable (not yet "improving")', () => {
            expect(trendFor(-3)).toBe('stable');
        });

        it('a delta just under the negative floor reads as improving', () => {
            expect(trendFor(-3.1)).toBe('improving');
        });
    });

    describe('conflicting signals (smoke-like PM profile during high traffic pollution)', () => {
        it('does not flag likely wildfire smoke when NO2 is also elevated', () => {
            // High PM2.5 with a PM2.5/PM10 ratio that looks smoke-like, but NO2 is well
            // above the traffic-pollution ceiling -- e.g. smoke rolling through during
            // rush hour. Should fail safe rather than over-claim a smoke signature.
            const result = analyzeSmokeTrend(
                [row({ pm25: 60, pm10: 65, no2: 58, so2: 2 })],
                []
            );
            expect(result?.likelyWildfireSmoke).toBe(false);
        });

        it('still reports an accurate worsening trend even when the smoke flag is false', () => {
            // The trend/peak calculation is independent of the smoke-source heuristic --
            // confirm the two don't get coupled by accident.
            const rows = Array.from({ length: 7 }, (_, i) =>
                row({ timestamp: hoursAgo(6 - i), pm25: 10 + i * 10, pm10: 12 + i * 10, no2: 58, so2: 2 })
            );
            const result = analyzeSmokeTrend(rows, []);
            expect(result?.direction).toBe('worsening');
            expect(result?.likelyWildfireSmoke).toBe(false);
        });
    });

    describe('forecast peak', () => {
        it('picks the highest future PM2.5, not the last one', () => {
            const result = analyzeSmokeTrend(
                [row({ pm25: 20, usAqi: 68 })],
                [
                    row({ timestamp: hoursAhead(4), pm25: 90, usAqi: 172 }),
                    row({ timestamp: hoursAhead(8), pm25: 60, usAqi: 152 }),
                    row({ timestamp: hoursAhead(24), pm25: 40, usAqi: 112 }),
                ]
            );
            expect(result?.next24hPeakPm25).toBe(90);
            expect(result?.next24hPeakUsAqi).toBe(172);
            expect(result?.next24hPeakAt).toEqual(hoursAhead(4));
        });

        it('does not report a peak below the current reading', () => {
            const result = analyzeSmokeTrend(
                [row({ pm25: 80, usAqi: 165 })],
                [row({ timestamp: hoursAhead(4), pm25: 30, usAqi: 90 })]
            );
            expect(result?.next24hPeakPm25).toBe(80);
            expect(result?.next24hPeakAt).toBeNull();
        });
    });
});
