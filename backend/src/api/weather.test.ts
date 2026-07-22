import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

const USER_ID = '11111111-1111-1111-1111-111111111111';

// A minimal thenable chain that stands in for drizzle's fluent query builder.
// `.from()/.where()/.orderBy()/.limit()` all just return the same chain object;
// `await`-ing it resolves to whatever result was queued for that call.
function makeChain(result: unknown[]) {
    const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve(result).then(resolve, reject),
    };
    return chain;
}

// db.select() is called 7 times per /api/weather/current request, in a fixed order:
// [0] latest weather row, [1] derivative, [2] aqi, [3] geomagnetic, [4] pollen,
// [5] smoke past rows, [6] smoke future rows.
function queueSelects(results: unknown[][]) {
    let i = 0;
    return vi.fn(() => makeChain(results[i++] ?? []));
}

const weatherRow = {
    userId: USER_ID,
    location: '40,-74',
    timestamp: new Date('2026-07-20T12:00:00Z'),
    pressure: '1013.2', temperature: '22.0', humidity: '55',
    windSpeed: '3.0', windDirection: '180', uvIndex: '5',
    cloudCover: '20', precipitation: '0', dewPoint: '12',
};

const aqiRow = {
    userId: USER_ID, location: '40,-74', timestamp: new Date(),
    pm25: '17.5', pm10: '17.6', ozone: '9', no2: '57.9', so2: '1.4', co: '251',
    usAqi: '35', europeanAqi: '27',
};

vi.mock('../db/index.js', () => ({
    db: { select: vi.fn() },
}));
vi.mock('../jobs/weather-poll.js', () => ({
    getCurrentConfig: vi.fn(() => ({ userId: USER_ID, latitude: '40', longitude: '-74' })),
}));
vi.mock('../services/purpleair.js', () => ({
    fetchHyperlocalAQI: vi.fn(),
}));

import { db } from '../db/index.js';
import { fetchHyperlocalAQI } from '../services/purpleair.js';
import { weatherRoutes } from './weather.js';

async function buildApp() {
    const app = Fastify();
    await app.register(weatherRoutes);
    return app;
}

describe('GET /api/weather/current', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes a populated hyperlocal + smokeTrend field when PurpleAir returns data', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([
                [weatherRow],  // latest
                [],            // derivative
                [aqiRow],      // aqi
                [],            // geomagnetic
                [],            // pollen
                [],            // smoke past rows (empty -> smokeTrend null, that's fine here)
                [],            // smoke future rows
            ])
        );
        (fetchHyperlocalAQI as ReturnType<typeof vi.fn>).mockResolvedValue({
            usAqi: 57, pm25: 15.1, sensorCount: 3, nearestMiles: 0.4,
        });

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/current' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.aqi.hyperlocal).toEqual({ usAqi: 57, pm25: 15.1, sensorCount: 3, nearestMiles: 0.4 });
        expect(body.aqi.usAqi).toBe(35);
        await app.close();
    });

    it('returns aqi.hyperlocal: null when PurpleAir is unavailable (key unset or fetch failed), without breaking the rest of the response', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([
                [weatherRow], [], [aqiRow], [], [], [], [],
            ])
        );
        (fetchHyperlocalAQI as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/current' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.aqi.hyperlocal).toBeNull();
        expect(body.aqi.usAqi).toBe(35);
        expect(body.pressure).toBe(1013.2);
        await app.close();
    });

    it('returns 404 when there is no weather data yet, without ever calling PurpleAir', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(queueSelects([[]]));

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/current' });

        expect(response.statusCode).toBe(404);
        expect(fetchHyperlocalAQI).not.toHaveBeenCalled();
        await app.close();
    });

    it('populates smokeTrend from the past/future AQ row queries', async () => {
        const now = Date.now();
        const past = Array.from({ length: 7 }, (_, i) => ({
            ...aqiRow,
            timestamp: new Date(now - (6 - i) * 3600_000),
            pm25: String(10 + i * 15),
            pm10: String(12 + i * 15),
            no2: '5', so2: '1',
            usAqi: String(30 + i * 20),
        }));

        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([
                [weatherRow], [], [aqiRow], [], [], past, [],
            ])
        );
        (fetchHyperlocalAQI as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/current' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.aqi.smokeTrend.direction).toBe('worsening');
        await app.close();
    });
});

describe('GET /api/weather/aqi-forecast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the hourly AQI/PM2.5 series', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: new Date('2026-07-20T12:00:00Z'), usAqi: '35', pm25: '17.5', pm10: '17.6' },
                { timestamp: new Date('2026-07-21T12:00:00Z'), usAqi: '87', pm25: '24.0', pm10: '25.0' },
            ]])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.count).toBe(2);
        expect(body.series[1].usAqi).toBe(87);
        await app.close();
    });

    it('returns 404 when there is no AQI data at all yet', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(queueSelects([[]]));

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast' });

        expect(response.statusCode).toBe(404);
        await app.close();
    });

    it('computes safe windows and identifies the current one', async () => {
        const now = Date.now();
        const hr = (n: number) => new Date(now + n * 3600_000);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: hr(-1), usAqi: '40', pm25: '10', pm10: '12' },
                { timestamp: hr(0), usAqi: '45', pm25: '10', pm10: '12' },  // "now" is safe
                { timestamp: hr(1), usAqi: '50', pm25: '10', pm10: '12' },
                { timestamp: hr(2), usAqi: '180', pm25: '80', pm10: '85' }, // sustained unhealthy
                { timestamp: hr(3), usAqi: '190', pm25: '85', pm10: '90' },
                { timestamp: hr(4), usAqi: '60', pm25: '15', pm10: '18' },  // clears up again
            ]])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.threshold).toBe(100);
        expect(body.safeWindows.length).toBe(2);
        expect(body.nextSafeWindow.isCurrent).toBe(true);
        // Same series crosses from Good (45) into Unhealthy (180, >=150) at hr(2).
        expect(body.categoryCrossing.toCategory).toBe('Unhealthy');
        await app.close();
    });

    it('reports categoryCrossing: null when nothing in the forecast is worse than now', async () => {
        const now = Date.now();
        const hr = (n: number) => new Date(now + n * 3600_000);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: hr(0), usAqi: '40', pm25: '10', pm10: '12' },
                { timestamp: hr(1), usAqi: '35', pm25: '9', pm10: '11' },
                { timestamp: hr(2), usAqi: '42', pm25: '10', pm10: '12' },
            ]])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast' });
        expect(response.json().categoryCrossing).toBeNull();
        await app.close();
    });

    it('accepts a custom ?hours= history lookback without erroring, clamped to [1, 168]', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[{ timestamp: new Date(), usAqi: '40', pm25: '10', pm10: '12' }]])
        );
        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast?hours=168' });
        expect(response.statusCode).toBe(200);
        await app.close();
    });

    it('scales the chart series to the requested history range (like PressureChart) while keeping safeWindows/categoryCrossing looking at the full 72h regardless of zoom', async () => {
        const now = Date.now();
        const hr = (n: number) => new Date(now + n * 3600_000);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: hr(0), usAqi: '40', pm25: '10', pm10: '12' },
                { timestamp: hr(4), usAqi: '45', pm25: '11', pm10: '13' },   // within a 6h chart window
                { timestamp: hr(50), usAqi: '180', pm25: '80', pm10: '85' }, // far beyond a 6h chart window, but still within the real 72h outlook
            ]])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast?hours=6' });
        const body = response.json();

        // Chart series (what actually gets plotted) is scaled down to ~6h -- the
        // far-future spike at +50h should not be part of what the chart renders.
        expect(body.series.length).toBe(2);
        expect(body.series.every((p: { timestamp: string }) => new Date(p.timestamp).getTime() <= now + 6 * 3600_000)).toBe(true);

        // But the category-crossing callout must still see the +50h spike -- that's
        // the whole point of not shrinking the underlying safety check just because
        // the chart is zoomed in.
        expect(body.categoryCrossing).not.toBeNull();
        expect(body.categoryCrossing.usAqi).toBe(180);
        await app.close();
    });

    it('caps the chart series at the real 72h forecast ceiling even when a 7d history range is requested', async () => {
        const now = Date.now();
        const hr = (n: number) => new Date(now + n * 3600_000);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: hr(0), usAqi: '40', pm25: '10', pm10: '12' },
                { timestamp: hr(80), usAqi: '50', pm25: '12', pm10: '14' }, // beyond the real 72h ceiling
            ]])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast?hours=168' });
        const body = response.json();

        expect(body.series.length).toBe(1);
        await app.close();
    });

    it('respects a custom ?threshold= query param', async () => {
        const now = Date.now();
        const hr = (n: number) => new Date(now + n * 3600_000);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: hr(0), usAqi: '120', pm25: '40', pm10: '45' },
            ]])
        );

        const app = await buildApp();
        const strict = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast?threshold=100' });
        expect(strict.json().safeWindows.length).toBe(0);
        await app.close();
    });

    it('honors an explicit ?threshold=0 rather than silently falling back to the default 100 (0 is falsy in JS)', async () => {
        const now = Date.now();
        const hr = (n: number) => new Date(now + n * 3600_000);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([[
                { timestamp: hr(0), usAqi: '35', pm25: '10', pm10: '12' },
            ]])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-forecast?threshold=0' });
        const body = response.json();
        expect(body.threshold).toBe(0);
        expect(body.safeWindows.length).toBe(0); // AQI 35 does not qualify under threshold 0
        await app.close();
    });
});

describe('GET /api/weather/aqi-burden', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('summarizes days at/above threshold from past readings', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([
                [
                    { timestamp: new Date('2026-07-01T12:00:00Z'), usAqi: '150' },
                    { timestamp: new Date('2026-07-02T12:00:00Z'), usAqi: '40' },
                    { timestamp: new Date('2026-07-03T12:00:00Z'), usAqi: '120' },
                ],
                [{ timezone: 'UTC' }],
            ])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-burden' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.days).toBe(90);
        expect(body.threshold).toBe(100);
        expect(body.totalDaysTracked).toBe(3);
        expect(body.daysAtOrAboveThreshold).toBe(2);
        await app.close();
    });

    it('returns 404 when there is no AQ history at all', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(queueSelects([[]]));

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-burden' });

        expect(response.statusCode).toBe(404);
        await app.close();
    });

    it('respects ?days= and ?threshold= query params', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([
                [{ timestamp: new Date('2026-07-01T12:00:00Z'), usAqi: '60' }],
                [{ timezone: 'UTC' }],
            ])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-burden?days=30&threshold=50' });
        const body = response.json();
        expect(body.days).toBe(30);
        expect(body.threshold).toBe(50);
        expect(body.daysAtOrAboveThreshold).toBe(1);
        await app.close();
    });

    it('groups by the saved users.timezone rather than UTC', async () => {
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(
            queueSelects([
                // 2026-07-01T04:00 UTC is 2026-06-30T23:00 in America/Chicago (CDT, UTC-5)
                [{ timestamp: new Date('2026-07-01T04:00:00Z'), usAqi: '150' }],
                [{ timezone: 'America/Chicago' }],
            ])
        );

        const app = await buildApp();
        const response = await app.inject({ method: 'GET', url: '/api/weather/aqi-burden' });
        const body = response.json();
        expect(body.dailyMax).toEqual([{ date: '2026-06-30', maxAqi: 150 }]);
        await app.close();
    });
});
