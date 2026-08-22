import { logger } from "../logger.js";

// ── PurpleAir (real ground-sensor AQI) ───────────────────────────────────────
// Open-Meteo's air-quality endpoint is a global atmospheric model (CAMS/Copernicus),
// not physical sensors -- coarse (~11km grid) and known to lag/under-predict sudden
// wildfire smoke plumes. PurpleAir is a dense network of real consumer PM2.5 sensors;
// when a key is configured this is preferred for actual current conditions at this
// exact location. Falls back to the Open-Meteo modeled reading automatically when no
// key is set, or on any fetch/parse failure -- this must never take down /current.
//
// Ported from the equivalent, already-running implementation in lair's home-hub API
// (routes/health.py::_fetch_purpleair_aqi) -- keep the two in sync if either changes.

const SENSORS_URL = "https://api.purpleair.com/v1/sensors";

// This is called on every /api/weather/current and /api/briefing request (frontend
// auto-refreshes every 5 min; add lair's own polling and manual use and real volume
// is easily 200-400+ calls/day). PurpleAir bills per sensor row returned, and a dense
// urban bounding box can return 50+ sensors -- measured live at 57 for a Chicago
// location. At that density, uncached, this alone could burn 3-6x the 1M/month free
// points tier (see docs/AQI_WILDFIRE_SMOKE_TESTING_PLAN.md for the worked math). A
// simple TTL cache keyed by location keeps this bounded regardless of request volume
// -- hourly freshness is plenty for a personal health-tracking app, not a real-time
// dispatch system.
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: {
  key: string;
  result: HyperlocalAQI | null;
  expiresAt: number;
} | null = null;

// Test-only: this module-level cache persists across test cases in the same file,
// which would otherwise pollute later tests with an earlier test's cached result.
export function _resetCacheForTests(): void {
  cache = null;
}

// EPA's published correction equation for PurpleAir PM2.5 during wildfire smoke (the
// same one behind the AirNow Fire and Smoke Map) -- raw PurpleAir readings run high in
// smoke/high-humidity conditions; this is confirmed ~90% NowCast-AQI-category accurate
// vs ~75% for uncorrected readings. See:
// https://cfpub.epa.gov/si/si_public_record_Report.cfm?dirEntryId=349513
function purpleAirEpaCorrection(
  pm25Cf1: number,
  humidity: number,
  tempF: number,
): number {
  const corrected =
    0.541 * pm25Cf1 - 0.0618 * humidity + 0.00534 * tempF + 3.634;
  return Math.max(0, corrected);
}

// EPA's standard piecewise-linear PM2.5 -> AQI breakpoint table (40 CFR Part 58 App. G).
const PM25_AQI_BREAKPOINTS: [number, number, number, number][] = [
  [0.0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

function pm25ToAqi(pm25: number): number {
  const rounded = Math.round(pm25 * 10) / 10;
  for (const [cLo, cHi, iLo, iHi] of PM25_AQI_BREAKPOINTS) {
    if (rounded <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (rounded - cLo) + iLo);
    }
  }
  return 500; // off the top of the table -- report the max rather than erroring
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dlat = toRad(lat2 - lat1);
  const dlng = toRad(lng2 - lng1);
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface HyperlocalAQI {
  usAqi: number;
  pm25: number;
  sensorCount: number;
  nearestMiles: number;
}

interface SensorsResponse {
  fields: string[];
  data: (number | null)[][];
}

export async function fetchHyperlocalAQI(
  latitude: string,
  longitude: string,
): Promise<HyperlocalAQI | null> {
  const apiKey = process.env.PURPLEAIR_API_KEY?.trim();
  if (!apiKey) return null;

  const cacheKey = `${latitude},${longitude}`;
  if (cache && cache.key === cacheKey && cache.expiresAt > Date.now()) {
    return cache.result;
  }

  const result = await fetchHyperlocalAQIUncached(latitude, longitude, apiKey);
  cache = { key: cacheKey, result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}

async function fetchHyperlocalAQIUncached(
  latitude: string,
  longitude: string,
  apiKey: string,
): Promise<HyperlocalAQI | null> {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  try {
    const delta = 0.15; // ~10 miles at this latitude -- wide enough to reliably find one
    const url = new URL(SENSORS_URL);
    url.searchParams.set(
      "fields",
      "latitude,longitude,location_type,confidence,last_seen,humidity,temperature,pm2.5_cf_1,pm2.5_cf_1_a,pm2.5_cf_1_b",
    );
    url.searchParams.set("nwlng", String(lng - delta));
    url.searchParams.set("nwlat", String(lat + delta));
    url.searchParams.set("selng", String(lng + delta));
    url.searchParams.set("selat", String(lat - delta));

    const response = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey },
    });
    if (!response.ok) {
      logger.warn(
        { service: "purpleair", status: response.status },
        "PurpleAir API error",
      );
      return null;
    }

    const payload: SensorsResponse = await response.json();
    const fields = payload.fields ?? [];
    const rows = payload.data ?? [];
    if (fields.length === 0 || rows.length === 0) return null;

    const idx: Record<string, number> = {};
    fields.forEach((name, i) => {
      idx[name] = i;
    });

    const nowSec = Date.now() / 1000;
    const candidates: {
      distance: number;
      pmRaw: number;
      humidity: number;
      tempF: number;
    }[] = [];

    for (const row of rows) {
      const locationType =
        idx["location_type"] !== undefined ? row[idx["location_type"]] : null;
      if (locationType !== 0) continue; // only outdoor sensors -- indoor sensors read totally different air

      const lastSeen =
        idx["last_seen"] !== undefined ? row[idx["last_seen"]] : null;
      if (!lastSeen || nowSec - lastSeen > 3600) continue; // stale/offline sensor

      const confidence =
        idx["confidence"] !== undefined ? row[idx["confidence"]] : 100;
      if (confidence !== null && confidence < 70) continue;

      const slat = idx["latitude"] !== undefined ? row[idx["latitude"]] : null;
      const slng =
        idx["longitude"] !== undefined ? row[idx["longitude"]] : null;
      if (slat === null || slng === null) continue;

      const pmA =
        idx["pm2.5_cf_1_a"] !== undefined ? row[idx["pm2.5_cf_1_a"]] : null;
      const pmB =
        idx["pm2.5_cf_1_b"] !== undefined ? row[idx["pm2.5_cf_1_b"]] : null;
      const pmRaw =
        pmA !== null && pmB !== null
          ? (pmA + pmB) / 2
          : idx["pm2.5_cf_1"] !== undefined
            ? row[idx["pm2.5_cf_1"]]
            : null;

      const humidity =
        idx["humidity"] !== undefined ? row[idx["humidity"]] : null;
      const tempF =
        idx["temperature"] !== undefined ? row[idx["temperature"]] : null;
      if (pmRaw === null || humidity === null || tempF === null) continue;

      const distance = haversineMiles(lat, lng, slat, slng);
      candidates.push({ distance, pmRaw, humidity, tempF });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.distance - b.distance);

    // Average the 3 nearest good sensors rather than trusting a single one -- an
    // individual low-cost sensor can be miscalibrated or locally obstructed.
    const nearest = candidates.slice(0, 3);
    const avgPmRaw = nearest.reduce((s, c) => s + c.pmRaw, 0) / nearest.length;
    const avgHumidity =
      nearest.reduce((s, c) => s + c.humidity, 0) / nearest.length;
    const avgTempF = nearest.reduce((s, c) => s + c.tempF, 0) / nearest.length;

    const pm25 =
      Math.round(purpleAirEpaCorrection(avgPmRaw, avgHumidity, avgTempF) * 10) /
      10;
    const usAqi = pm25ToAqi(pm25);

    return {
      usAqi,
      pm25,
      sensorCount: nearest.length,
      nearestMiles: Math.round(nearest[0].distance * 10) / 10,
    };
  } catch (error) {
    logger.error(
      { service: "purpleair", err: error },
      "PurpleAir fetch failed",
    );
    return null;
  }
}
