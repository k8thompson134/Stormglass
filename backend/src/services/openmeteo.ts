import { eq, and, gte, lte, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { weatherData } from '../db/schema.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_VARS = [
  'surface_pressure',
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'uv_index',
  'cloud_cover',
  'precipitation',
].join(',');

interface OpenMeteoHourly {
  time: string[];
  surface_pressure: (number | null)[];
  temperature_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  dew_point_2m: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  uv_index: (number | null)[];
  cloud_cover: (number | null)[];
  precipitation: (number | null)[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: OpenMeteoHourly;
}

export async function fetchWeatherData(
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
  url.searchParams.set('forecast_days', '7');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data: OpenMeteoResponse = await response.json();
  const location = `${latitude},${longitude}`;
  const hourly = data.hourly;

  // Build rows, skipping any with null pressure
  const rows = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const pressure = hourly.surface_pressure[i];
    if (pressure === null) continue;

    rows.push({
      userId,
      location,
      timestamp: new Date(hourly.time[i]),
      pressure: String(pressure),
      temperature: String(hourly.temperature_2m[i] ?? 0),
      humidity: String(hourly.relative_humidity_2m[i] ?? 0),
      windSpeed: String(hourly.wind_speed_10m[i] ?? 0),
      windDirection: String(hourly.wind_direction_10m[i] ?? 0),
      uvIndex: String(hourly.uv_index[i] ?? 0),
      cloudCover: String(hourly.cloud_cover[i] ?? 0),
      precipitation: String(hourly.precipitation[i] ?? 0),
      dewPoint: String(hourly.dew_point_2m[i] ?? 0),
    });
  }

  if (rows.length === 0) return 0;

  const now = new Date();
  // Forecast rows (timestamp in the future) are model predictions that Open-Meteo
  // revises on every run. Refetching them as "already exists, skip" would leave
  // pressure.ts computing the migraine signal from a stale forecast once the real
  // observation arrives at that same timestamp, so we replace them wholesale each
  // poll instead of dedup-by-timestamp (mirrors airquality.ts).
  const pastRows = rows.filter(r => r.timestamp <= now);
  const futureRows = rows.filter(r => r.timestamp > now);

  let inserted = 0;

  if (pastRows.length > 0) {
    // Batch-fetch existing timestamps to avoid N+1 queries
    const timestamps = pastRows.map(r => r.timestamp);
    const minTs = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const maxTs = new Date(Math.max(...timestamps.map(t => t.getTime())));

    const existingRows = await db
      .select({ timestamp: weatherData.timestamp })
      .from(weatherData)
      .where(
        and(
          eq(weatherData.userId, userId),
          eq(weatherData.location, location),
          gte(weatherData.timestamp, minTs),
          lte(weatherData.timestamp, maxTs)
        )
      );

    const existingSet = new Set(existingRows.map(r => r.timestamp.getTime()));
    const newPastRows = pastRows.filter(r => !existingSet.has(r.timestamp.getTime()));

    if (newPastRows.length > 0) {
      await db.insert(weatherData).values(newPastRows);
      inserted += newPastRows.length;
    }
  }

  if (futureRows.length > 0) {
    // Wrapped in a transaction so a concurrent read (e.g. pressure.ts landing mid-poll)
    // can never observe the forecast rows deleted but not yet reinserted -- postgres's
    // default read-committed isolation means other transactions won't see the delete
    // until this one commits.
    await db.transaction(async (tx) => {
      await tx.delete(weatherData).where(
        and(
          eq(weatherData.userId, userId),
          eq(weatherData.location, location),
          gt(weatherData.timestamp, now)
        )
      );
      await tx.insert(weatherData).values(futureRows);
    });
    inserted += futureRows.length;
  }

  return inserted;
}
