import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { airQualityData } from '../db/schema.js';

const BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const HOURLY_VARS = [
    'us_aqi',
    'european_aqi',
    'pm2_5',
    'pm10',
    'carbon_monoxide',
    'nitrogen_dioxide',
    'sulphur_dioxide',
    'ozone',
].join(',');

interface AQHourly {
    time: string[];
    us_aqi: (number | null)[];
    european_aqi: (number | null)[];
    pm2_5: (number | null)[];
    pm10: (number | null)[];
    carbon_monoxide: (number | null)[];
    nitrogen_dioxide: (number | null)[];
    sulphur_dioxide: (number | null)[];
    ozone: (number | null)[];
}

interface AQResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    hourly: AQHourly;
}

export async function fetchAirQualityData(
    userId: string,
    latitude: string,
    longitude: string
): Promise<number> {
    const url = new URL(BASE_URL);
    url.searchParams.set('latitude', latitude);
    url.searchParams.set('longitude', longitude);
    url.searchParams.set('hourly', HOURLY_VARS);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('past_days', '2');
    url.searchParams.set('forecast_days', '1');

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Open-Meteo AQ API error: ${response.status} ${response.statusText}`);
    }

    const data: AQResponse = await response.json();
    const location = `${latitude},${longitude}`;
    const hourly = data.hourly;

    // Build rows, skipping any with null AQI
    const rows = [];
    for (let i = 0; i < hourly.time.length; i++) {
        const usAqi = hourly.us_aqi[i];
        if (usAqi === null) continue;

        rows.push({
            userId,
            location,
            timestamp: new Date(hourly.time[i]),
            pm25: String(hourly.pm2_5[i] ?? 0),
            pm10: String(hourly.pm10[i] ?? 0),
            ozone: String(hourly.ozone[i] ?? 0),
            no2: String(hourly.nitrogen_dioxide[i] ?? 0),
            so2: String(hourly.sulphur_dioxide[i] ?? 0),
            co: String(hourly.carbon_monoxide[i] ?? 0),
            usAqi: String(usAqi),
            europeanAqi: String(hourly.european_aqi[i] ?? 0),
        });
    }

    if (rows.length === 0) return 0;

    // Batch-fetch existing timestamps to avoid N+1 queries
    const timestamps = rows.map(r => r.timestamp);
    const minTs = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const maxTs = new Date(Math.max(...timestamps.map(t => t.getTime())));

    const existingRows = await db
        .select({ timestamp: airQualityData.timestamp })
        .from(airQualityData)
        .where(
            and(
                eq(airQualityData.userId, userId),
                eq(airQualityData.location, location),
                gte(airQualityData.timestamp, minTs),
                lte(airQualityData.timestamp, maxTs)
            )
        );

    const existingSet = new Set(existingRows.map(r => r.timestamp.getTime()));
    const newRows = rows.filter(r => !existingSet.has(r.timestamp.getTime()));

    if (newRows.length === 0) return 0;

    await db.insert(airQualityData).values(newRows);
    return newRows.length;
}
