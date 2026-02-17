import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { geomagneticData } from '../db/schema.js';

const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';

interface KpEntry {
    timeTag: string;
    kp: number;
    aRunning: number;
    stationCount: number;
}

interface PlasmaEntry {
    density: number;
    speed: number;
}

function parseKpData(raw: string[][]): KpEntry[] {
    // First row is the header: ["time_tag","Kp","a_running","station_count"]
    return raw.slice(1).map((row) => ({
        timeTag: row[0],
        kp: parseFloat(row[1]),
        aRunning: parseFloat(row[2]),
        stationCount: parseInt(row[3], 10),
    }));
}

function parseLatestPlasma(raw: string[][]): PlasmaEntry | null {
    // First row is header: ["time_tag","density","speed","temperature"]
    // Walk backwards to find the latest row with non-null density and speed
    for (let i = raw.length - 1; i >= 1; i--) {
        const density = parseFloat(raw[i][1]);
        const speed = parseFloat(raw[i][2]);
        if (!isNaN(density) && !isNaN(speed)) {
            return { density, speed };
        }
    }
    return null;
}

export async function fetchGeomagneticData(userId: string): Promise<number> {
    // Fetch Kp index data (3-hourly readings, ~7 days)
    const kpResponse = await fetch(KP_URL);
    if (!kpResponse.ok) {
        throw new Error(`NOAA Kp API error: ${kpResponse.status} ${kpResponse.statusText}`);
    }
    const kpRaw: string[][] = await kpResponse.json();
    const kpEntries = parseKpData(kpRaw);

    // Fetch latest solar wind plasma data
    let latestPlasma: PlasmaEntry | null = null;
    try {
        const plasmaResponse = await fetch(PLASMA_URL);
        if (plasmaResponse.ok) {
            const plasmaRaw: string[][] = await plasmaResponse.json();
            latestPlasma = parseLatestPlasma(plasmaRaw);
        }
    } catch {
        // Solar wind data is supplementary — don't fail if unavailable
        console.warn('[geomagnetic] Solar wind plasma data unavailable, continuing with Kp only');
    }

    if (kpEntries.length === 0) return 0;

    // Build all rows first
    const rows = kpEntries.map(entry => ({
        userId,
        timestamp: new Date(entry.timeTag.replace(' ', 'T') + 'Z'),
        kpIndex: String(entry.kp),
        kpEstimated: String(entry.kp), // NOAA provides observed Kp, use as estimated too
        solarWindSpeed: String(latestPlasma?.speed ?? 0),
        solarWindDensity: String(latestPlasma?.density ?? 0),
    }));

    // Batch-fetch existing timestamps to avoid N+1 queries
    const timestamps = rows.map(r => r.timestamp);
    const minTs = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const maxTs = new Date(Math.max(...timestamps.map(t => t.getTime())));

    const existingRows = await db
        .select({ timestamp: geomagneticData.timestamp })
        .from(geomagneticData)
        .where(
            and(
                eq(geomagneticData.userId, userId),
                gte(geomagneticData.timestamp, minTs),
                lte(geomagneticData.timestamp, maxTs)
            )
        );

    const existingSet = new Set(existingRows.map(r => r.timestamp.getTime()));
    const newRows = rows.filter(r => !existingSet.has(r.timestamp.getTime()));

    if (newRows.length === 0) return 0;

    await db.insert(geomagneticData).values(newRows);
    return newRows.length;
}
