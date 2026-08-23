import { db } from "../db/index.js";
import { pollenData } from "../db/schema.js";
import { logger } from "../logger.js";

const BASE_URL = "https://api.tomorrow.io/v4/weather/forecast";
const FETCH_TIMEOUT_MS = 15_000;

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
  longitude: string,
): Promise<number> {
  // .trim() matches purpleair.ts's PURPLEAIR_API_KEY handling -- previously this
  // didn't trim, so a whitespace-only key would be silently sent upstream here
  // (yielding a 403) while purpleair.ts's equivalent correctly treated it as absent.
  const apiKey = process.env.TOMORROW_API_KEY?.trim();
  if (!apiKey) {
    logger.warn(
      { service: "tomorrow" },
      "API key not found, skipping pollen fetch",
    );
    return 0;
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("fields", "treeIndex,grassIndex,weedIndex,moldIndex");
  url.searchParams.set("timesteps", "1d");
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      if (response.status === 403) {
        logger.warn(
          { service: "tomorrow" },
          "Forbidden: API key may not have access to Pollen (Premium)",
        );
        return 0;
      }
      throw new Error(
        `Tomorrow.io API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: TomorrowResponse = await response.json();
    const location = `${latitude},${longitude}`;
    const daily = data.timelines.daily;

    if (!daily || daily.length === 0) return 0;

    // Build rows, skipping entries where all values are null
    const rows = daily
      .filter(
        (day) =>
          !(
            day.values.treeIndex === null &&
            day.values.grassIndex === null &&
            day.values.weedIndex === null
          ),
      )
      .map((day) => ({
        userId,
        location,
        timestamp: new Date(day.time),
        treeIndex: day.values.treeIndex ?? 0,
        grassIndex: day.values.grassIndex ?? 0,
        weedIndex: day.values.weedIndex ?? 0,
        moldIndex: day.values.moldIndex ?? 0,
      }));

    if (rows.length === 0) return 0;

    // Relies on the (user_id, location, timestamp) unique constraint rather than
    // a read-then-filter dedup query -- the DB rejects (silently, per row) any
    // row already present instead of the app having to check first.
    const inserted = await db
      .insert(pollenData)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: pollenData.id });
    return inserted.length;
  } catch (error) {
    logger.error(
      { service: "tomorrow", err: error },
      "Error fetching pollen data",
    );
    return 0;
  }
}
