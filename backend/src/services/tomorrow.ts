import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pollenData } from '../db/schema.js';

const BASE_URL = 'https://api.tomorrow.io/v4/weather/forecast';

interface TomorrowDaily {
    time: string;
    values: {
        treeIndex: number | null;
        grassIndex: number | null;
        weedIndex: number | null;
        moldIndex?: number | null; // Placeholder if available
    };
}

interface TomorrowResponse {
    timelines: {
        daily: TomorrowDaily[];
    };
}

export async function fetchPollenData(
    userId: string,
    latitude: string,
    longitude: string
): Promise<number> {
    const apiKey = process.env.TOMORROW_API_KEY;
    if (!apiKey) {
        console.warn('[tomorrow] API key not found in environment, skipping pollen fetch');
        return 0;
    }

    const url = new URL(BASE_URL);
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('fields', 'treeIndex,grassIndex,weedIndex,moldIndex');
    url.searchParams.set('timesteps', '1d');
    url.searchParams.set('apikey', apiKey);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            if (response.status === 403) {
                console.warn('[tomorrow] Forbidden: Your API key may not have access to Pollen (Premium).');
                return 0;
            }
            throw new Error(`Tomorrow.io API error: ${response.status} ${response.statusText}`);
        }

        const data: TomorrowResponse = await response.json();
        const location = `${latitude},${longitude}`;
        const daily = data.timelines.daily;

        if (!daily || daily.length === 0) return 0;

        // Build rows, skipping entries where all values are null
        const rows = daily
            .filter(day => !(day.values.treeIndex === null && day.values.grassIndex === null && day.values.weedIndex === null))
            .map(day => ({
                userId,
                location,
                timestamp: new Date(day.time),
                treeIndex: day.values.treeIndex ?? 0,
                grassIndex: day.values.grassIndex ?? 0,
                weedIndex: day.values.weedIndex ?? 0,
                moldIndex: day.values.moldIndex ?? 0,
            }));

        if (rows.length === 0) return 0;

        // Batch-fetch existing timestamps to avoid N+1 queries
        const timestamps = rows.map(r => r.timestamp);
        const minTs = new Date(Math.min(...timestamps.map(t => t.getTime())));
        const maxTs = new Date(Math.max(...timestamps.map(t => t.getTime())));

        const existingRows = await db
            .select({ timestamp: pollenData.timestamp })
            .from(pollenData)
            .where(
                and(
                    eq(pollenData.userId, userId),
                    eq(pollenData.location, location),
                    gte(pollenData.timestamp, minTs),
                    lte(pollenData.timestamp, maxTs)
                )
            );

        const existingSet = new Set(existingRows.map(r => r.timestamp.getTime()));
        const newRows = rows.filter(r => !existingSet.has(r.timestamp.getTime()));

        if (newRows.length === 0) return 0;

        await db.insert(pollenData).values(newRows);
        return newRows.length;
    } catch (error) {
        console.error('[tomorrow] Error fetching pollen data:', error);
        return 0;
    }
}
