import cron from 'node-cron';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { fetchWeatherData } from '../services/openmeteo.js';
import { computePressureDerivatives } from '../services/pressure.js';
import { fetchAirQualityData } from '../services/airquality.js';
import { fetchGeomagneticData } from '../services/geomagnetic.js';
import { fetchPollenData } from '../services/tomorrow.js';
import { findNextCategoryCrossing, classifyAqiCategory, CATEGORY_ORDER } from '../utils/aqiWindows.js';
import {
  isPushConfigured,
  sendAqiCrossingAlert,
  clearAqiCrossingDedupState,
  sendCurrentAqiBadAlert,
  clearCurrentAqiBadDedupState,
  sendMigraineRiskAlert,
  clearMigraineRiskDedupState,
} from '../services/push.js';
import { getMigraineRisk } from '../utils/healthLogic.js';
import { db } from '../db/index.js';
import { airQualityData, pressureDerivatives } from '../db/schema.js';
import { logger } from '../logger.js';

export interface PollConfig {
  userId: string;
  latitude: string;
  longitude: string;
  name?: string;
}

let currentTask: cron.ScheduledTask | null = null;
let currentConfig: PollConfig | null = null;

async function runPoll(config: PollConfig): Promise<void> {
  const { userId, latitude, longitude } = config;
  const location = `${latitude},${longitude}`;

  try {
    const inserted = await fetchWeatherData(userId, latitude, longitude);
    logger.info({ service: 'weather-poll', inserted }, 'Fetched new weather readings');

    // Run derivatives and other data fetches in parallel (all depend only on userId/location)
    const [derivatives, aqInserted, geoInserted, pollenInserted] = await Promise.all([
      computePressureDerivatives(userId, location),
      fetchAirQualityData(userId, latitude, longitude),
      fetchGeomagneticData(userId),
      fetchPollenData(userId, latitude, longitude),
    ]);

    logger.info({ service: 'weather-poll', derivatives }, 'Computed new pressure derivatives');
    logger.info({ service: 'air-quality-poll', inserted: aqInserted }, 'Fetched new AQ readings');
    logger.info({ service: 'geomagnetic-poll', inserted: geoInserted }, 'Fetched new Kp readings');
    logger.info({ service: 'pollen-poll', inserted: pollenInserted }, 'Fetched new pollen readings');

    await checkAqiCategoryCrossing(location);
    await checkMigraineRisk(userId, location);
  } catch (error) {
    logger.error({ service: 'weather-poll', err: error }, 'Poll cycle failed');
  }
}

/**
 * Runs every poll cycle so a spike in migraine risk reaches you even if the app
 * isn't open -- only alerts on high/severe (not moderate) since pressure risk
 * oscillates far more than AQI category and a lower threshold would cry wolf.
 */
async function checkMigraineRisk(userId: string, location: string): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    const [latestDerivative] = await db
      .select({
        delta1h: pressureDerivatives.delta1h,
        delta3h: pressureDerivatives.delta3h,
        delta6h: pressureDerivatives.delta6h,
      })
      .from(pressureDerivatives)
      .where(and(eq(pressureDerivatives.userId, userId), eq(pressureDerivatives.location, location)))
      .orderBy(desc(pressureDerivatives.timestamp))
      .limit(1);

    if (!latestDerivative) return;

    const now = new Date();
    const [latestAqi] = await db
      .select({ usAqi: airQualityData.usAqi })
      .from(airQualityData)
      .where(and(eq(airQualityData.location, location), lte(airQualityData.timestamp, now)))
      .orderBy(desc(airQualityData.timestamp))
      .limit(1);

    const currentAqi = latestAqi ? parseFloat(latestAqi.usAqi) : null;
    const risk = getMigraineRisk(
      parseFloat(latestDerivative.delta1h),
      parseFloat(latestDerivative.delta3h),
      parseFloat(latestDerivative.delta6h),
      currentAqi
    );

    if (risk.risk === 'high' || risk.risk === 'severe') {
      await sendMigraineRiskAlert({ riskLevel: risk.risk, delta1h: parseFloat(latestDerivative.delta1h) });
    } else {
      await clearMigraineRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: 'push' }, `Migraine risk check failed: ${error}`);
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
const CURRENT_BAD_THRESHOLD_CATEGORY_IDX = CATEGORY_ORDER.indexOf('Unhealthy for Sensitive Groups');

/**
 * Runs on every poll cycle (not just when the frontend happens to be open) so a
 * worsening AQI forecast reaches you even if the app isn't sitting open in a tab --
 * the whole point of push notifications over the in-app-only banner.
 */
async function checkAqiCategoryCrossing(location: string): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    const now = new Date();
    const since = new Date(now.getTime() - 60 * 60 * 1000); // 1h back, enough to find "current"
    const until = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const rows = await db
      .select({ timestamp: airQualityData.timestamp, usAqi: airQualityData.usAqi })
      .from(airQualityData)
      .where(and(gte(airQualityData.timestamp, since), lte(airQualityData.timestamp, until), eq(airQualityData.location, location)))
      .orderBy(airQualityData.timestamp)
      .limit(200);

    if (rows.length === 0) return;

    const points = rows.map(r => ({ timestamp: r.timestamp, usAqi: parseFloat(r.usAqi) }));
    const pastPoints = points.filter(p => p.timestamp <= now);
    const currentPoint = pastPoints[pastPoints.length - 1] ?? points[0];
    const futurePoints = points.filter(p => p.timestamp > now);

    const crossing = findNextCategoryCrossing(currentPoint.usAqi, futurePoints, now);

    if (crossing && crossing.at.getTime() - now.getTime() <= AQI_ALERT_LOOKAHEAD_MS) {
      await sendAqiCrossingAlert({ toCategory: crossing.toCategory, usAqi: crossing.usAqi, at: crossing.at.toISOString() });
    } else if (!crossing) {
      await clearAqiCrossingDedupState();
    }
    // else: crossing found but still outside the lookahead window -- leave dedup
    // state alone, it'll be evaluated again next poll as it gets closer.

    // "Bad right now" is evaluated independently of the forecast crossing above --
    // it can fire even if the crossing alert already covered this same worsening,
    // and it's the one that catches "AQI is bad and the forecast heads-up already
    // fired hours ago" or "AQI worsened faster than the forecast predicted."
    const currentCategory = classifyAqiCategory(currentPoint.usAqi);
    if (CATEGORY_ORDER.indexOf(currentCategory) >= CURRENT_BAD_THRESHOLD_CATEGORY_IDX) {
      await sendCurrentAqiBadAlert({ category: currentCategory, usAqi: currentPoint.usAqi });
    } else {
      await clearCurrentAqiBadDedupState();
    }
  } catch (error) {
    logger.error({ service: 'push' }, `AQI category-crossing check failed: ${error}`);
  }
}

export function startWeatherPolling(config: PollConfig): void {
  currentConfig = config;

  // Run immediately on startup
  runPoll(config);

  // Then every 30 minutes
  currentTask = cron.schedule('*/30 * * * *', () => {
    runPoll(config);
  });

  logger.info({ service: 'weather-poll' }, 'Scheduled every 30 minutes');
}

export async function restartWeatherPolling(newConfig: Partial<PollConfig>): Promise<PollConfig | null> {
  if (!currentConfig) return null;

  // Stop existing cron
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  // Merge new config
  currentConfig = { ...currentConfig, ...newConfig };

  if (currentConfig.name) {
    logger.info({ service: 'weather-poll', name: currentConfig.name }, 'Location name updated');
  }

  // Fetch data for new location before returning
  await runPoll(currentConfig);

  // Then schedule recurring polls
  currentTask = cron.schedule('*/30 * * * *', () => {
    runPoll(currentConfig!);
  });

  logger.info({ service: 'weather-poll', location: `${currentConfig.latitude},${currentConfig.longitude}` }, 'Restarted polling');

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
}
