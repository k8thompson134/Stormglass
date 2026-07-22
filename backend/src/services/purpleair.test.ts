import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHyperlocalAQI, _resetCacheForTests } from './purpleair.js';

const FIELDS = [
    'latitude', 'longitude', 'location_type', 'confidence', 'last_seen',
    'humidity', 'temperature', 'pm2.5_cf_1', 'pm2.5_cf_1_a', 'pm2.5_cf_1_b',
];

interface SensorOverrides {
    latitude?: number;
    longitude?: number;
    locationType?: number;
    confidence?: number;
    lastSeenSecondsAgo?: number;
    humidity?: number;
    temperature?: number;
    pm25CfA?: number;
    pm25CfB?: number;
}

function sensorRow(o: SensorOverrides = {}): (number | null)[] {
    const nowSec = Date.now() / 1000;
    const pmA = o.pm25CfA ?? 50;
    const pmB = o.pm25CfB ?? 50;
    return [
        o.latitude ?? 40.0,
        o.longitude ?? -74.0,
        o.locationType ?? 0,
        o.confidence ?? 90,
        nowSec - (o.lastSeenSecondsAgo ?? 60),
        o.humidity ?? 40,
        o.temperature ?? 75,
        (pmA + pmB) / 2,
        pmA,
        pmB,
    ];
}

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }): void {
    const { jsonBody, ...rest } = response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => jsonBody,
        ...rest,
    } as Response));
}

describe('fetchHyperlocalAQI', () => {
    const originalKey = process.env.PURPLEAIR_API_KEY;

    beforeEach(() => {
        process.env.PURPLEAIR_API_KEY = 'test-key';
        _resetCacheForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalKey === undefined) delete process.env.PURPLEAIR_API_KEY;
        else process.env.PURPLEAIR_API_KEY = originalKey;
    });

    it('returns null without making a request when no API key is configured', async () => {
        delete process.env.PURPLEAIR_API_KEY;
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('falls back to null on a network error rather than throwing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network down')));

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).toBeNull();
    });

    it('falls back to null on a non-OK response (e.g. 500 or rate limited)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
            ok: false,
            status: 503,
            json: async () => ({}),
        } as Response));

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).toBeNull();
    });

    it('falls back to null when the response has no sensors in range', async () => {
        mockFetchOnce({ jsonBody: { fields: FIELDS, data: [] } });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).toBeNull();
    });

    it('averages fewer than 3 sensors when that is all that is available (rural/low-density case)', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [sensorRow({ pm25CfA: 40, pm25CfB: 40 })],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).not.toBeNull();
        expect(result?.sensorCount).toBe(1);
    });

    it('excludes sensors last seen more than an hour ago and falls back to null if none remain', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [
                    sensorRow({ lastSeenSecondsAgo: 3601 }),
                    sensorRow({ lastSeenSecondsAgo: 7200 }),
                ],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).toBeNull();
    });

    it('keeps a sensor last seen just under the 1h staleness cutoff', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [sensorRow({ lastSeenSecondsAgo: 3599 })],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).not.toBeNull();
        expect(result?.sensorCount).toBe(1);
    });

    it('excludes sensors below the confidence-70 floor', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [sensorRow({ confidence: 69 })],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).toBeNull();
    });

    it('keeps a sensor exactly at the confidence-70 floor', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [sensorRow({ confidence: 70 })],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).not.toBeNull();
        expect(result?.sensorCount).toBe(1);
    });

    it('excludes indoor sensors (location_type != 0) -- indoor air reads totally differently', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [
                    sensorRow({ locationType: 1 }),
                    sensorRow({ locationType: 0, latitude: 40.01 }),
                ],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result).not.toBeNull();
        expect(result?.sensorCount).toBe(1);
    });

    it('averages the 3 nearest sensors and ignores a farther 4th', async () => {
        mockFetchOnce({
            jsonBody: {
                fields: FIELDS,
                data: [
                    sensorRow({ latitude: 40.001, pm25CfA: 10, pm25CfB: 10 }),
                    sensorRow({ latitude: 40.002, pm25CfA: 20, pm25CfB: 20 }),
                    sensorRow({ latitude: 40.003, pm25CfA: 30, pm25CfB: 30 }),
                    sensorRow({ latitude: 40.1, pm25CfA: 500, pm25CfB: 500 }), // far away, should be excluded
                ],
            },
        });

        const result = await fetchHyperlocalAQI('40.0', '-74.0');

        expect(result?.sensorCount).toBe(3);
        // If the far sensor were included it would dominate the average (500 vs ~20).
        expect(result!.pm25).toBeLessThan(50);
    });

    describe('caching', () => {
        it('does not refetch within the cache TTL for the same location', async () => {
            const fetchSpy = vi.fn().mockResolvedValue({
                ok: true, status: 200,
                json: async () => ({ fields: FIELDS, data: [sensorRow()] }),
            } as Response);
            vi.stubGlobal('fetch', fetchSpy);

            const first = await fetchHyperlocalAQI('40.0', '-74.0');
            const second = await fetchHyperlocalAQI('40.0', '-74.0');

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(second).toEqual(first);
        });

        it('refetches for a different location even if one is cached', async () => {
            const fetchSpy = vi.fn().mockResolvedValue({
                ok: true, status: 200,
                json: async () => ({ fields: FIELDS, data: [sensorRow()] }),
            } as Response);
            vi.stubGlobal('fetch', fetchSpy);

            await fetchHyperlocalAQI('40.0', '-74.0');
            await fetchHyperlocalAQI('41.0', '-75.0');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('caches a null result too, so a sustained outage does not retry every request', async () => {
            const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
            vi.stubGlobal('fetch', fetchSpy);

            const first = await fetchHyperlocalAQI('40.0', '-74.0');
            const second = await fetchHyperlocalAQI('40.0', '-74.0');

            expect(first).toBeNull();
            expect(second).toBeNull();
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });
    });
});
