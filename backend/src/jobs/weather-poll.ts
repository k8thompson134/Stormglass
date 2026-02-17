import cron from 'node-cron';
import { fetchWeatherData } from '../services/openmeteo.js';
import { computePressureDerivatives } from '../services/pressure.js';
import { fetchAirQualityData } from '../services/airquality.js';
import { fetchGeomagneticData } from '../services/geomagnetic.js';
import { fetchPollenData } from '../services/tomorrow.js';

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
    console.log(`[weather-poll] Fetched ${inserted} new weather readings`);

    const derivatives = await computePressureDerivatives(userId, location);
    console.log(`[weather-poll] Computed ${derivatives} new pressure derivatives`);

    const aqInserted = await fetchAirQualityData(userId, latitude, longitude);
    console.log(`[air-quality-poll] Fetched ${aqInserted} new AQ readings`);

    const geoInserted = await fetchGeomagneticData(userId);
    console.log(`[geomagnetic-poll] Fetched ${geoInserted} new Kp readings`);

    const pollenInserted = await fetchPollenData(userId, latitude, longitude);
    console.log(`[pollen-poll] Fetched ${pollenInserted} new pollen readings`);
  } catch (error) {
    console.error('[weather-poll] Error:', error);
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

  console.log('[weather-poll] Scheduled every 30 minutes');
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
    console.log(`[weather-poll] Location name updated to: ${currentConfig.name}`);
  }

  // Fetch data for new location before returning
  await runPoll(currentConfig);

  // Then schedule recurring polls
  currentTask = cron.schedule('*/30 * * * *', () => {
    runPoll(currentConfig!);
  });

  console.log(`[weather-poll] Restarted with location: ${currentConfig.latitude},${currentConfig.longitude}`);

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
