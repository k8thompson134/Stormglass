import { db } from "../db/index.js";
import { geomagneticData } from "../db/schema.js";
import { logger } from "../logger.js";

const KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const PLASMA_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";
const FETCH_TIMEOUT_MS = 15_000;

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

interface NoaaKpObject {
  time_tag: string;
  Kp: number;
  a_running: number;
  station_count: number;
}

function parseKpData(raw: NoaaKpObject[]): KpEntry[] {
  return raw.map((row) => ({
    timeTag: row.time_tag,
    kp: row.Kp,
    aRunning: row.a_running,
    stationCount: row.station_count,
  }));
}

function parseLatestPlasma(raw: (string | number)[][]): PlasmaEntry | null {
  // First row is header: ["time_tag","density","speed","temperature"]
  // Walk backwards to find the latest row with non-null density and speed
  for (let i = raw.length - 1; i >= 1; i--) {
    const row = raw[i];
    const density = parseFloat(String(row[1]));
    const speed = parseFloat(String(row[2]));
    if (!isNaN(density) && !isNaN(speed)) {
      return { density, speed };
    }
  }
  return null;
}

export async function fetchGeomagneticData(userId: string): Promise<number> {
  // Fetch Kp index data (3-hourly readings, ~7 days)
  const kpResponse = await fetch(KP_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!kpResponse.ok) {
    logger.error(
      { service: "geomagnetic", status: kpResponse.status },
      "NOAA Kp API error",
    );
    throw new Error(
      `NOAA Kp API error: ${kpResponse.status} ${kpResponse.statusText}`,
    );
  }
  const kpRaw: NoaaKpObject[] = await kpResponse.json();
  // Sorted defensively rather than trusted as-is -- NOAA's feed is chronologically
  // ascending today (verified live), but nothing in their API contract guarantees
  // that stays true, and the "stamp the latest plasma reading on the newest row"
  // fix below silently mis-stamps a historical row instead of erroring if it ever
  // doesn't.
  const kpEntries = parseKpData(kpRaw).sort(
    (a, b) => new Date(a.timeTag).getTime() - new Date(b.timeTag).getTime(),
  );

  // Fetch latest solar wind plasma data
  let latestPlasma: PlasmaEntry | null = null;
  try {
    const plasmaResponse = await fetch(PLASMA_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (plasmaResponse.ok) {
      const plasmaRaw: string[][] = await plasmaResponse.json();
      latestPlasma = parseLatestPlasma(plasmaRaw);
    }
  } catch {
    // Solar wind data is supplementary — don't fail if unavailable
    logger.warn(
      { service: "geomagnetic" },
      "Solar wind plasma data unavailable, continuing with Kp only",
    );
  }

  if (kpEntries.length === 0) return 0;

  // NOAA only gives us ONE current plasma reading, not a history of one per Kp
  // timestamp -- stamping it onto every historical row (as this used to do) fabricates
  // ~56 rows' worth of solar-wind data that never actually applied at those past
  // times. Only the most recent Kp entry (the one closest to "now") gets the real
  // reading; older rows get 0, which every consumer (getGeomagneticRisk, the
  // frontend's `> 0` guards) already treats as "no data" rather than a real zero.
  const latestEntryIndex = kpEntries.length - 1;
  const rows = kpEntries.map((entry, i) => ({
    userId,
    timestamp: new Date(entry.timeTag.replace(" ", "T") + "Z"),
    kpIndex: String(entry.kp),
    kpEstimated: String(entry.kp), // NOAA provides observed Kp, use as estimated too
    solarWindSpeed: String(
      i === latestEntryIndex ? (latestPlasma?.speed ?? 0) : 0,
    ),
    solarWindDensity: String(
      i === latestEntryIndex ? (latestPlasma?.density ?? 0) : 0,
    ),
  }));

  // Relies on the (user_id, timestamp) unique constraint rather than a
  // read-then-filter dedup query -- the DB rejects (silently, per row) any
  // timestamp already present instead of the app having to check first.
  const inserted = await db
    .insert(geomagneticData)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: geomagneticData.id });
  return inserted.length;
}
