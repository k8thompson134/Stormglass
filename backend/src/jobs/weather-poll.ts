import cron from "node-cron";
import { fetchWeatherData } from "../services/openmeteo.js";
import { computePressureDerivatives } from "../services/pressure.js";
import { fetchAirQualityData } from "../services/airquality.js";
import { fetchGeomagneticData } from "../services/geomagnetic.js";
import { fetchPollenData } from "../services/tomorrow.js";
import { pruneNotificationLog } from "../services/push.js";
import {
  type PollConfig,
  getCurrentConfig,
  setCurrentConfig,
} from "../services/runtime-config.js";
import {
  fetchAqiWindow,
  fetchLatestDerivative,
  fetchLatestWeather,
  checkAqiCategoryCrossing,
  checkClearAirWindow,
  checkMigraineRisk,
  checkMecfsRisk,
  checkPotsRisk,
} from "./alert-checks.js";
import { logger } from "../logger.js";

let currentTask: cron.ScheduledTask | null = null;
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

export function startWeatherPolling(config: PollConfig): void {
  setCurrentConfig(config);

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
  const existingConfig = getCurrentConfig();
  if (!existingConfig) return null;

  // Stop existing cron
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  // Merge new config
  const mergedConfig = { ...existingConfig, ...newConfig };
  setCurrentConfig(mergedConfig);

  if (mergedConfig.name) {
    logger.info(
      { service: "weather-poll", name: mergedConfig.name },
      "Location name updated",
    );
  }

  // Fetch data for new location before returning
  await runPoll(mergedConfig);

  // Then schedule recurring polls
  currentTask = cron.schedule("*/30 * * * *", () => {
    runPoll(mergedConfig);
  });

  logger.info(
    {
      service: "weather-poll",
      location: `${mergedConfig.latitude},${mergedConfig.longitude}`,
    },
    "Restarted polling",
  );

  return mergedConfig;
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
