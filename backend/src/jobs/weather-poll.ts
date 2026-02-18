import cron from 'node-cron';
import { fetchWeatherData } from '../services/openmeteo.js';
import { computePressureDerivatives } from '../services/pressure.js';
import { fetchAirQualityData } from '../services/airquality.js';
import { fetchGeomagneticData } from '../services/geomagnetic.js';
import { fetchPollenData } from '../services/tomorrow.js';
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

    const derivatives = await computePressureDerivatives(userId, location);
    logger.info({ service: 'weather-poll', derivatives }, 'Computed new pressure derivatives');

    const aqInserted = await fetchAirQualityData(userId, latitude, longitude);
    logger.info({ service: 'air-quality-poll', inserted: aqInserted }, 'Fetched new AQ readings');

    const geoInserted = await fetchGeomagneticData(userId);
    logger.info({ service: 'geomagnetic-poll', inserted: geoInserted }, 'Fetched new Kp readings');

    const pollenInserted = await fetchPollenData(userId, latitude, longitude);
    logger.info({ service: 'pollen-poll', inserted: pollenInserted }, 'Fetched new pollen readings');
  } catch (error) {
    logger.error({ service: 'weather-poll', err: error }, 'Poll cycle failed');
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
