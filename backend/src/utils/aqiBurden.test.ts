import { describe, it, expect } from 'vitest';
import { summarizeAqiBurden, type AqiBurdenPoint } from './aqiBurden.js';

function point(iso: string, usAqi: number): AqiBurdenPoint {
    return { timestamp: new Date(iso), usAqi };
}

describe('summarizeAqiBurden', () => {
    it('returns zeros for an empty input', () => {
        const result = summarizeAqiBurden([], 100);
        expect(result.totalDaysTracked).toBe(0);
        expect(result.daysAtOrAboveThreshold).toBe(0);
        expect(result.dailyMax).toEqual([]);
    });

    it('takes the max reading per calendar day, not the average', () => {
        const rows = [
            point('2026-07-01T00:00:00Z', 20),
            point('2026-07-01T12:00:00Z', 180),
            point('2026-07-01T23:00:00Z', 40),
        ];
        const result = summarizeAqiBurden(rows, 100);
        expect(result.dailyMax).toEqual([{ date: '2026-07-01', maxAqi: 180 }]);
    });

    it('counts distinct days at or above the threshold', () => {
        const rows = [
            point('2026-07-01T12:00:00Z', 150), // above
            point('2026-07-02T12:00:00Z', 40),  // below
            point('2026-07-03T12:00:00Z', 100), // exactly at threshold -- counts
            point('2026-07-04T12:00:00Z', 99),  // just below -- does not count
        ];
        const result = summarizeAqiBurden(rows, 100);
        expect(result.totalDaysTracked).toBe(4);
        expect(result.daysAtOrAboveThreshold).toBe(2);
    });

    it('returns dailyMax sorted chronologically regardless of input order', () => {
        const rows = [
            point('2026-07-03T00:00:00Z', 50),
            point('2026-07-01T00:00:00Z', 60),
            point('2026-07-02T00:00:00Z', 70),
        ];
        const result = summarizeAqiBurden(rows, 100);
        expect(result.dailyMax.map(d => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    });

    it('handles multiple readings landing on the same day from unsorted input', () => {
        const rows = [
            point('2026-07-01T23:00:00Z', 30),
            point('2026-07-01T01:00:00Z', 130),
            point('2026-07-01T12:00:00Z', 80),
        ];
        const result = summarizeAqiBurden(rows, 100);
        expect(result.dailyMax).toEqual([{ date: '2026-07-01', maxAqi: 130 }]);
    });

    describe('timezone handling', () => {
        it('defaults to UTC when no timezone is given', () => {
            const result = summarizeAqiBurden([point('2026-07-01T23:30:00Z', 50)], 100);
            expect(result.dailyMax[0].date).toBe('2026-07-01');
        });

        it('groups a late-evening UTC reading into the NEXT day in an eastern timezone', () => {
            // 2026-07-01T23:30 UTC is 2026-07-02T02:30 in a UTC+3 zone (e.g. Kuwait) --
            // the same instant lands on a different calendar day depending on timezone.
            const result = summarizeAqiBurden([point('2026-07-01T23:30:00Z', 50)], 100, 'Asia/Kuwait');
            expect(result.dailyMax[0].date).toBe('2026-07-02');
        });

        it('groups an early-morning UTC reading into the PREVIOUS day in a western US timezone', () => {
            // 2026-07-01T04:00 UTC is 2026-06-30T21:00 (or 20:00 std) in America/Chicago.
            const result = summarizeAqiBurden([point('2026-07-01T04:00:00Z', 50)], 100, 'America/Chicago');
            expect(result.dailyMax[0].date).toBe('2026-06-30');
        });

        it('merges readings that fall on the same local day even though they cross a UTC day boundary', () => {
            const rows = [
                point('2026-07-01T23:00:00Z', 40), // 2026-07-01 18:00 Chicago (CDT, UTC-5)
                point('2026-07-02T02:00:00Z', 90), // 2026-07-01 21:00 Chicago -- same local day
            ];
            const result = summarizeAqiBurden(rows, 100, 'America/Chicago');
            expect(result.dailyMax).toEqual([{ date: '2026-07-01', maxAqi: 90 }]);
        });

        it('falls back to UTC on an invalid timezone rather than throwing', () => {
            expect(() => summarizeAqiBurden([point('2026-07-01T12:00:00Z', 50)], 100, 'Not/AZone')).not.toThrow();
            const result = summarizeAqiBurden([point('2026-07-01T12:00:00Z', 50)], 100, 'Not/AZone');
            expect(result.dailyMax[0].date).toBe('2026-07-01');
        });
    });
});
