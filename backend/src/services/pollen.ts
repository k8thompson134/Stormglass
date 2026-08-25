import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { pollenData } from "../db/schema.js";
import { logger } from "../logger.js";
import { env } from "../env.js";

// ── Google Pollen API (Maps Platform) ────────────────────────────────────────
// Replaced Tomorrow.io (task 251): its free/current tier doesn't include real
// pollen coverage, so it silently returned all-zero tree/grass/weed/mold fields
// on every request (200 OK, not a 403) instead of erroring -- the pollen card had
// been showing fabricated-looking-real zeros the entire time. Google's Pollen API
// reports a real 0-5 Universal Pollen Index per type, which maps directly onto
// this table's existing tree_index/grass_index/weed_index columns.
//
// Google does not cover mold at all (no MOLD entry in pollenTypeInfo) -- mold_index
// is written as 0 always. That's not a regression: Tomorrow.io's mold field was
// already always 0 in production (its "Placeholder if available" comment was never
// backed by real data either).
const BASE_URL = "https://pollen.googleapis.com/v1/forecast:lookup";
const FETCH_TIMEOUT_MS = 15_000;
const FORECAST_DAYS = 5; // Google's documented max for forecast:lookup

interface PollenIndexInfo {
  value: number;
}

interface PollenTypeInfo {
  code: "TREE" | "GRASS" | "WEED";
  indexInfo?: PollenIndexInfo;
}

interface DailyInfo {
  date: { year: number; month: number; day: number };
  pollenTypeInfo: PollenTypeInfo[];
}

interface GooglePollenResponse {
  dailyInfo: DailyInfo[];
}

function indexFor(pollenTypes: PollenTypeInfo[], code: string): number {
  // Absent entirely, or present but out of season with no indexInfo, both mean
  // "no pollen of this type right now" -- 0 is the accurate reading, not a
  // missing-data placeholder.
  return pollenTypes.find((t) => t.code === code)?.indexInfo?.value ?? 0;
}

export async function fetchPollenData(
  userId: string,
  latitude: string,
  longitude: string,
): Promise<number> {
  const apiKey = env.GOOGLE_POLLEN_API_KEY;
  if (!apiKey) {
    logger.warn(
      { service: "pollen" },
      "Google Pollen API key not found, skipping pollen fetch",
    );
    return 0;
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("location.latitude", latitude);
  url.searchParams.set("location.longitude", longitude);
  url.searchParams.set("days", String(FORECAST_DAYS));

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(
        { service: "pollen", status: response.status },
        "Google Pollen API error",
      );
      return 0;
    }

    const data: GooglePollenResponse = await response.json();
    const location = `${latitude},${longitude}`;
    const daily = data.dailyInfo;

    if (!daily || daily.length === 0) return 0;

    const rows = daily.map((day) => {
      const { year, month, day: dom } = day.date;
      return {
        userId,
        location,
        // Google gives a calendar date with no time-of-day -- stamped at midnight
        // UTC, matching the once-per-day granularity of the underlying forecast.
        timestamp: new Date(Date.UTC(year, month - 1, dom)),
        treeIndex: indexFor(day.pollenTypeInfo, "TREE"),
        grassIndex: indexFor(day.pollenTypeInfo, "GRASS"),
        weedIndex: indexFor(day.pollenTypeInfo, "WEED"),
        moldIndex: 0,
      };
    });

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    // "Today" is treated as immutable once recorded (mirrors openmeteo.ts/
    // airquality.ts's past-rows handling) -- future days are forecasts Google
    // revises on every call, so re-fetching them as "already exists, skip" would
    // leave getPollenRisk reading a stale multi-day-old forecast once the real
    // value updates. Replaced wholesale each poll instead of dedup-by-timestamp.
    const todayRows = rows.filter((r) => r.timestamp <= todayStart);
    const futureRows = rows.filter((r) => r.timestamp > todayStart);

    let inserted = 0;

    if (todayRows.length > 0) {
      // Relies on the (user_id, location, timestamp) unique constraint rather
      // than a read-then-filter dedup query -- the DB rejects (silently, per
      // row) any row already present instead of the app having to check first.
      const newTodayRows = await db
        .insert(pollenData)
        .values(todayRows)
        .onConflictDoNothing()
        .returning({ id: pollenData.id });
      inserted += newTodayRows.length;
    }

    if (futureRows.length > 0) {
      // Wrapped in a transaction so a concurrent read can never observe the
      // forecast rows deleted but not yet reinserted -- postgres's default
      // read-committed isolation means other transactions won't see the delete
      // until this one commits.
      await db.transaction(async (tx) => {
        await tx
          .delete(pollenData)
          .where(
            and(
              eq(pollenData.userId, userId),
              eq(pollenData.location, location),
              gt(pollenData.timestamp, todayStart),
            ),
          );
        await tx.insert(pollenData).values(futureRows);
      });
      inserted += futureRows.length;
    }

    return inserted;
  } catch (error) {
    logger.error(
      { service: "pollen", err: error },
      "Error fetching pollen data",
    );
    return 0;
  }
}
