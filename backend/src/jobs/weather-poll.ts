import cron from 'node-cron';
import { and, eq, gte, lte } from 'drizzle-orm';
import { fetchWeatherData } from '../services/openmeteo.js';
import { computePressureDerivatives } from '../services/pressure.js';
import { fetchAirQualityData } from '../services/airquality.js';
import { fetchGeomagneticData } from '../services/geomagnetic.js';
import { fetchPollenData } from '../services/tomorrow.js';
import { findNextCategoryCrossing } from '../utils/aqiWindows.js';
import { isPushConfigured, sendAqiCrossingAlert, clearAqiCrossingDedupState } from '../services/push.js';
import { db } from '../db/index.js';
import { airQualityData } from '../db/schema.js';
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
  } catch (error) {
    logger.error({ service: 'weather-poll', err: error }, 'Poll cycle failed');
  }
}

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

    if (crossing) {
      await sendAqiCrossingAlert({ toCategory: crossing.toCategory, usAqi: crossing.usAqi, at: crossing.at.toISOString() });
    } else {
      await clearAqiCrossingDedupState();
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
