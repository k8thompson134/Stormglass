import cron from "node-cron";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { fetchWeatherData } from "../services/openmeteo.js";
import { computePressureDerivatives } from "../services/pressure.js";
import { fetchAirQualityData } from "../services/airquality.js";
import { fetchGeomagneticData } from "../services/geomagnetic.js";
import { fetchPollenData } from "../services/tomorrow.js";
import {
  findNextCategoryCrossing,
  findCategoryClearTime,
  findSafeWindows,
  nextSafeWindow,
  getCategoryCeiling,
  classifyAqiCategory,
  CATEGORY_ORDER,
} from "../utils/aqiWindows.js";
import {
  isPushConfigured,
  sendAqiCrossingAlert,
  clearAqiCrossingDedupState,
  sendCurrentAqiBadAlert,
  clearCurrentAqiBadDedupState,
  sendMigraineRiskAlert,
  clearMigraineRiskDedupState,
  sendMecfsRiskAlert,
  clearMecfsRiskDedupState,
  sendPotsRiskAlert,
  clearPotsRiskDedupState,
  sendClearAirAlert,
  resetClearAirDedupState,
  pruneNotificationLog,
} from "../services/push.js";
import {
  getMigraineRisk,
  getMECFSRisk,
  getPOTSRisk,
} from "../utils/healthLogic.js";
import { db } from "../db/index.js";
import {
  airQualityData,
  pressureDerivatives,
  weatherData,
} from "../db/schema.js";
import { logger } from "../logger.js";

export interface PollConfig {
  userId: string;
  latitude: string;
  longitude: string;
  name?: string;
}

let currentTask: cron.ScheduledTask | null = null;
let currentConfig: PollConfig | null = null;
let retentionTask: cron.ScheduledTask | null = null;

/**
 * Unwraps a settled result, logging+returning a fallback on rejection instead of
 * throwing -- so one adapter failing (network error, timeout) doesn't take down
 * the rest of the poll cycle, including the downstream push checks that don't
 * depend on it at all.
 */
function logSettled<T>(
  service: string,
  result: PromiseSettledResult<T>,
  fallback: T,
): T {
  if (result.status === "fulfilled") return result.value;
  logger.error(
    { service: `${service}-poll`, err: result.reason },
    `${service} fetch failed`,
  );
  return fallback;
}

async function runPoll(config: PollConfig): Promise<void> {
  const { userId, latitude, longitude } = config;
  const location = `${latitude},${longitude}`;

  try {
    const [weatherResult] = await Promise.allSettled([
      fetchWeatherData(userId, latitude, longitude),
    ]);
    const inserted = logSettled("openmeteo", weatherResult, 0);
    logger.info(
      { service: "weather-poll", inserted },
      "Fetched new weather readings",
    );

    // Run derivatives and other data fetches in parallel (all depend only on
    // userId/location) -- allSettled so one throwing adapter (e.g. a timeout) can't
    // reject the whole cycle and skip the push checks below.
    const [derivativesResult, aqResult, geoResult, pollenResult] =
      await Promise.allSettled([
        computePressureDerivatives(userId, location),
        fetchAirQualityData(userId, latitude, longitude),
        fetchGeomagneticData(userId),
        fetchPollenData(userId, latitude, longitude),
      ]);
    const derivatives = logSettled("pressure", derivativesResult, 0);
    const aqInserted = logSettled("air-quality", aqResult, 0);
    const geoInserted = logSettled("geomagnetic", geoResult, 0);
    const pollenInserted = logSettled("pollen", pollenResult, 0);

    logger.info(
      { service: "weather-poll", derivatives },
      "Computed new pressure derivatives",
    );
    logger.info(
      { service: "air-quality-poll", inserted: aqInserted },
      "Fetched new AQ readings",
    );
    logger.info(
      { service: "geomagnetic-poll", inserted: geoInserted },
      "Fetched new Kp readings",
    );
    logger.info(
      { service: "pollen-poll", inserted: pollenInserted },
      "Fetched new pollen readings",
    );

    // Fetched once and shared across every check below (they all need either "the
    // current AQI reading" or "the latest pressure derivative"), then the checks
    // themselves run in parallel -- they read independent tables (pushSubscriptions
    // filtered by different flags, pressureDerivatives vs. airQualityData vs.
    // weatherData) and none depends on another's result.
    const [aqiWindow, latestDerivative, latestWeather] = await Promise.all([
      fetchAqiWindow(location),
      fetchLatestDerivative(userId, location),
      fetchLatestWeather(userId, location),
    ]);
    const currentAqi = aqiWindow?.currentPoint.usAqi ?? null;

    await Promise.all([
      checkAqiCategoryCrossing(location, aqiWindow),
      checkClearAirWindow(aqiWindow),
      checkMigraineRisk(latestDerivative, currentAqi),
      checkMecfsRisk(latestDerivative, currentAqi),
      checkPotsRisk(latestDerivative, latestWeather, currentAqi),
    ]);
  } catch (error) {
    logger.error({ service: "weather-poll", err: error }, "Poll cycle failed");
  }
}

interface AqiPoint {
  timestamp: Date;
  usAqi: number;
}

interface AqiWindow {
  now: Date;
  currentPoint: AqiPoint;
  futurePoints: AqiPoint[];
}

/**
 * Fetches "the current AQI reading plus the forecast ahead of it" once per poll
 * cycle -- both checkAqiCategoryCrossing (crossing detection) and checkMigraineRisk
 * (feeds AQI into the risk calc) need the current reading, and used to each query
 * airQualityData separately for it.
 */
async function fetchAqiWindow(location: string): Promise<AqiWindow | null> {
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60 * 1000); // 1h back, enough to find "current"
  const until = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const rows = await db
    .select({
      timestamp: airQualityData.timestamp,
      usAqi: airQualityData.usAqi,
    })
    .from(airQualityData)
    .where(
      and(
        gte(airQualityData.timestamp, since),
        lte(airQualityData.timestamp, until),
        eq(airQualityData.location, location),
      ),
    )
    .orderBy(airQualityData.timestamp)
    .limit(200);

  if (rows.length === 0) return null;

  const points = rows.map((r) => ({
    timestamp: r.timestamp,
    usAqi: parseFloat(r.usAqi),
  }));
  const pastPoints = points.filter((p) => p.timestamp <= now);
  const currentPoint = pastPoints[pastPoints.length - 1] ?? points[0];
  const futurePoints = points.filter((p) => p.timestamp > now);

  return { now, currentPoint, futurePoints };
}

interface LatestDerivative {
  delta1h: number;
  delta3h: number;
  delta6h: number;
}

/**
 * Fetched once per poll cycle and shared by every pressure-derived risk check
 * (migraine, ME/CFS, POTS) -- these used to each run their own identical query.
 */
async function fetchLatestDerivative(
  userId: string,
  location: string,
): Promise<LatestDerivative | null> {
  const [row] = await db
    .select({
      delta1h: pressureDerivatives.delta1h,
      delta3h: pressureDerivatives.delta3h,
      delta6h: pressureDerivatives.delta6h,
    })
    .from(pressureDerivatives)
    .where(
      and(
        eq(pressureDerivatives.userId, userId),
        eq(pressureDerivatives.location, location),
      ),
    )
    .orderBy(desc(pressureDerivatives.timestamp))
    .limit(1);

  if (!row) return null;
  return {
    delta1h: parseFloat(row.delta1h),
    delta3h: parseFloat(row.delta3h),
    delta6h: parseFloat(row.delta6h),
  };
}

interface LatestWeather {
  humidity: number;
  temperature: number;
}

/** Latest humidity/temperature reading -- POTS risk needs both alongside pressure. */
async function fetchLatestWeather(
  userId: string,
  location: string,
): Promise<LatestWeather | null> {
  const [row] = await db
    .select({
      humidity: weatherData.humidity,
      temperature: weatherData.temperature,
    })
    .from(weatherData)
    .where(
      and(eq(weatherData.userId, userId), eq(weatherData.location, location)),
    )
    .orderBy(desc(weatherData.timestamp))
    .limit(1);

  if (!row) return null;
  return {
    humidity: parseFloat(row.humidity),
    temperature: parseFloat(row.temperature),
  };
}

/**
 * Runs every poll cycle so a spike in migraine risk reaches you even if the app
 * isn't open -- only alerts on high/severe (not moderate) since pressure risk
 * oscillates far more than AQI category and a lower threshold would cry wolf.
 */
async function checkMigraineRisk(
  latestDerivative: LatestDerivative | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative) return;

  try {
    const risk = getMigraineRisk(
      latestDerivative.delta1h,
      latestDerivative.delta3h,
      latestDerivative.delta6h,
      currentAqi,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      await sendMigraineRiskAlert({
        riskLevel: risk.risk,
        delta1h: latestDerivative.delta1h,
      });
    } else {
      await clearMigraineRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `Migraine risk check failed: ${error}`);
  }
}

/**
 * Runs every poll cycle -- same high/severe-only threshold reasoning as migraine
 * above, since ME/CFS pressure-volatility risk oscillates on a similar timescale.
 */
async function checkMecfsRisk(
  latestDerivative: LatestDerivative | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative) return;

  try {
    const risk = getMECFSRisk(
      latestDerivative.delta1h,
      latestDerivative.delta3h,
      latestDerivative.delta6h,
      currentAqi,
    );
    const volatility =
      Math.abs(latestDerivative.delta1h) +
      Math.abs(latestDerivative.delta3h) +
      Math.abs(latestDerivative.delta6h);

    if (risk.risk === "high" || risk.risk === "severe") {
      await sendMecfsRiskAlert({ riskLevel: risk.risk, volatility });
    } else {
      await clearMecfsRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `ME/CFS risk check failed: ${error}`);
  }
}

/**
 * Runs every poll cycle -- needs the latest weather reading (humidity/temperature)
 * in addition to the pressure derivative every other risk check uses, since POTS
 * risk is driven by heat/cold/humidity stacking with pressure swings, not pressure
 * alone.
 */
async function checkPotsRisk(
  latestDerivative: LatestDerivative | null,
  latestWeather: LatestWeather | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative || !latestWeather) return;

  try {
    const risk = getPOTSRisk(
      latestDerivative.delta1h,
      latestWeather.humidity,
      latestWeather.temperature,
      currentAqi,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      // getPOTSRisk computes its own primaryStressor internally (for its detailed
      // explanation text) but doesn't return it as part of HealthRisk -- mirrors its
      // isHot(>24)/isCold(<5) thresholds here rather than widen the shared HealthRisk
      // type just for this one alert's phrasing. isVeryHot(>30)/isVeryCold(<-5) don't
      // need separate checks: both are subsets already caught by isHot/isCold.
      const tempF = Math.round((latestWeather.temperature * 9) / 5 + 32);
      const isHot = latestWeather.temperature > 24;
      const isCold = latestWeather.temperature < 5;
      const primaryStressor = isHot ? "heat" : isCold ? "cold" : "pressure";
      await sendPotsRiskAlert({ riskLevel: risk.risk, primaryStressor, tempF });
    } else {
      await clearPotsRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `POTS risk check failed: ${error}`);
  }
}

// Only alert on a forecast crossing once it's this close -- a crossing found further
// out is real but not yet actionable, and pushing for it immediately (a 72h scan
// used to fire as soon as ANY future crossing was found) is exactly what produced
// alerts landing at odd hours for events well over half a day away. Each 30-min poll
// re-evaluates, so as a distant crossing gets closer it naturally enters this window
// and fires once -- nothing is lost, it's just not pushed before it's relevant.
const AQI_ALERT_LOOKAHEAD_MS = 3 * 60 * 60 * 1000;

// Threshold for "bad right now" -- matches the app's own "safe to go outside" cutoff
// (AQI_CONFIG / the aqi-forecast endpoint's default threshold of 100).
const CURRENT_BAD_THRESHOLD_CATEGORY_IDX = CATEGORY_ORDER.indexOf(
  "Unhealthy for Sensitive Groups",
);

/**
 * Runs on every poll cycle (not just when the frontend happens to be open) so a
 * worsening AQI forecast reaches you even if the app isn't sitting open in a tab --
 * the whole point of push notifications over the in-app-only banner.
 */
async function checkAqiCategoryCrossing(
  location: string,
  aqiWindow: AqiWindow | null,
): Promise<void> {
  if (!isPushConfigured()) return;
  if (!aqiWindow) return;

  try {
    const { now, currentPoint, futurePoints } = aqiWindow;
    const crossing = findNextCategoryCrossing(
      currentPoint.usAqi,
      futurePoints,
      now,
    );

    if (
      crossing &&
      crossing.at.getTime() - now.getTime() <= AQI_ALERT_LOOKAHEAD_MS
    ) {
      // "When does it clear" -- scanned from the crossing point forward through the
      // same futurePoints already fetched this cycle, so the alert can say "until
      // ~9pm" instead of just "starting at 4pm" when the forecast actually shows an
      // end to it within the lookahead window.
      const toCategoryIdx = CATEGORY_ORDER.indexOf(crossing.toCategory);
      const clearAt = findCategoryClearTime(
        futurePoints,
        crossing.at,
        toCategoryIdx,
      );
      await sendAqiCrossingAlert({
        toCategory: crossing.toCategory,
        usAqi: crossing.usAqi,
        at: crossing.at.toISOString(),
        clearAt: clearAt ? clearAt.toISOString() : null,
      });
    } else if (!crossing) {
      await clearAqiCrossingDedupState();
    }
    // else: crossing found but still outside the lookahead window -- leave dedup
    // state alone, it'll be evaluated again next poll as it gets closer. (Dedup
    // itself is keyed on category+date, not category alone, so a later crossing
    // into the same category on a different day still fires -- see push.ts.)

    // "Bad right now" is evaluated independently of the forecast crossing above --
    // it can fire even if the crossing alert already covered this same worsening,
    // and it's the one that catches "AQI is bad and the forecast heads-up already
    // fired hours ago" or "AQI worsened faster than the forecast predicted."
    const currentCategory = classifyAqiCategory(currentPoint.usAqi);
    if (
      CATEGORY_ORDER.indexOf(currentCategory) >=
      CURRENT_BAD_THRESHOLD_CATEGORY_IDX
    ) {
      const clearAt = findCategoryClearTime(
        futurePoints,
        now,
        CURRENT_BAD_THRESHOLD_CATEGORY_IDX,
      );
      await sendCurrentAqiBadAlert({
        category: currentCategory,
        usAqi: currentPoint.usAqi,
        clearAt: clearAt ? clearAt.toISOString() : null,
      });
    } else {
      await clearCurrentAqiBadDedupState();
    }
  } catch (error) {
    logger.error(
      { service: "push" },
      `AQI category-crossing check failed: ${error}`,
    );
  }
}

// "Safe" ceiling for the clean-air alert -- matches CURRENT_BAD_THRESHOLD_CATEGORY_IDX
// above (Moderate and below is "safe," USG and up is "bad"). There's no per-user
// sensitivity threshold available here (that preference lives in frontend
// localStorage only, never sent to the backend poll job), so this uses the same
// fixed cutoff the other AQI alerts already use rather than guessing a threshold.
const CLEAR_AIR_THRESHOLD = getCategoryCeiling("Moderate");

// Ignore windows shorter than this -- a 20-minute gap between two bad stretches
// isn't a real "good time to go outside," it's noise in the hourly forecast data.
const MIN_CLEAR_AIR_WINDOW_HOURS = 2;

/**
 * Runs on every poll cycle -- the positive-framing complement to the "bad right
 * now"/"worsening soon" alerts above: tells you when a genuinely clean stretch is
 * coming up, for planning outdoor time, rather than only reacting to bad air.
 * Reuses findSafeWindows/nextSafeWindow, already built for (and used by) the in-app
 * AQI forecast chart -- this is the same computation, just also pushed.
 */
async function checkClearAirWindow(aqiWindow: AqiWindow | null): Promise<void> {
  if (!isPushConfigured() || !aqiWindow) return;

  try {
    const { now, currentPoint, futurePoints } = aqiWindow;
    const points = [currentPoint, ...futurePoints];
    const windows = findSafeWindows(points, CLEAR_AIR_THRESHOLD, now);
    const next = nextSafeWindow(windows, now);

    // Only alert on an UPCOMING window (not one already underway -- "starting soon"
    // wouldn't be true of right now) that's close enough to be actionable (same
    // lookahead as the AQI crossing alert) and long enough to be worth planning
    // around.
    if (
      next &&
      !next.isCurrent &&
      next.start.getTime() - now.getTime() <= AQI_ALERT_LOOKAHEAD_MS &&
      next.durationHours >= MIN_CLEAR_AIR_WINDOW_HOURS
    ) {
      await sendClearAirAlert({
        startAt: next.start.toISOString(),
        endAt: next.end.toISOString(),
        durationHours: next.durationHours,
        avgAqi: next.avgAqi,
      });
    } else if (!next || next.isCurrent) {
      // No upcoming window found, or the "safe" window is the one we're already in
      // -- either way there's nothing left to announce, so clear dedup so a later
      // genuinely new window isn't silently skipped.
      await resetClearAirDedupState();
    }
    // else: window found but still outside the lookahead, or too short -- leave
    // dedup alone, re-evaluated next poll as it either gets closer or resolves.
  } catch (error) {
    logger.error(
      { service: "push" },
      `Clear-air window check failed: ${error}`,
    );
  }
}

export function startWeatherPolling(config: PollConfig): void {
  currentConfig = config;

  // Run immediately on startup
  runPoll(config);

  // Then every 30 minutes
  currentTask = cron.schedule("*/30 * * * *", () => {
    runPoll(config);
  });

  logger.info({ service: "weather-poll" }, "Scheduled every 30 minutes");

  // Retention is independent of location/config, so it's only ever started here
  // (not re-scheduled on restartWeatherPolling's location changes) -- guard against
  // double-scheduling if startWeatherPolling somehow ran twice.
  if (!retentionTask) {
    pruneNotificationLog()
      .then((count) => {
        if (count > 0) {
          logger.info(
            { service: "weather-poll", count },
            "Pruned old push notification log rows on startup",
          );
        }
      })
      .catch((err) =>
        logger.error(
          { service: "weather-poll", err },
          "Startup notification log prune failed",
        ),
      );

    retentionTask = cron.schedule("0 3 * * *", () => {
      pruneNotificationLog()
        .then((count) => {
          if (count > 0) {
            logger.info(
              { service: "weather-poll", count },
              "Pruned old push notification log rows",
            );
          }
        })
        .catch((err) =>
          logger.error(
            { service: "weather-poll", err },
            "Notification log prune failed",
          ),
        );
    });
    logger.info(
      { service: "weather-poll" },
      "Notification log retention scheduled daily at 3am",
    );
  }
}

export async function restartWeatherPolling(
  newConfig: Partial<PollConfig>,
): Promise<PollConfig | null> {
  if (!currentConfig) return null;

  // Stop existing cron
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  // Merge new config
  currentConfig = { ...currentConfig, ...newConfig };

  if (currentConfig.name) {
    logger.info(
      { service: "weather-poll", name: currentConfig.name },
      "Location name updated",
    );
  }

  // Fetch data for new location before returning
  await runPoll(currentConfig);

  // Then schedule recurring polls
  currentTask = cron.schedule("*/30 * * * *", () => {
    runPoll(currentConfig!);
  });

  logger.info(
    {
      service: "weather-poll",
      location: `${currentConfig.latitude},${currentConfig.longitude}`,
    },
    "Restarted polling",
  );

  return currentConfig;
}

export function getCurrentConfig(): PollConfig | null {
  return currentConfig;
}

export function stopPolling(): void {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
  if (retentionTask) {
    retentionTask.stop();
    retentionTask = null;
  }
}
