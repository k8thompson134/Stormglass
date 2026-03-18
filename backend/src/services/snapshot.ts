import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  weatherData,
  pressureDerivatives,
  airQualityData,
  geomagneticData,
  pollenData,
} from '../db/schema.js';
export interface EnvironmentalSnapshot {
  pressure: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  dewPoint: number;
  uvIndex: number;
  cloudCover: number;
  precipitation: number;
  derivative: {
    delta1h: number;
    delta3h: number;
    delta6h: number;
    trend: 'rising' | 'falling' | 'stable';
  } | null;
  aqi: {
    usAqi: number;
    pm25: number;
    pm10: number;
    ozone: number;
    no2: number;
    so2: number;
    co: number;
  } | null;
  geomagnetic: {
    kpIndex: number;
    solarWindSpeed: number;
    solarWindDensity: number;
  } | null;
  pollen: {
    treeIndex: number;
    grassIndex: number;
    weedIndex: number;
    moldIndex: number;
  } | null;
}

export async function assembleCurrentSnapshot(
  userId: string
): Promise<EnvironmentalSnapshot | null> {
  const [latestRows, derivativeRows, aqiRows, geoRows, pollenRows] =
    await Promise.all([
      db
        .select()
        .from(weatherData)
        .where(eq(weatherData.userId, userId))
        .orderBy(desc(weatherData.timestamp))
        .limit(1),
      db
        .select()
        .from(pressureDerivatives)
        .where(eq(pressureDerivatives.userId, userId))
        .orderBy(desc(pressureDerivatives.timestamp))
        .limit(1),
      db
        .select()
        .from(airQualityData)
        .where(eq(airQualityData.userId, userId))
        .orderBy(desc(airQualityData.timestamp))
        .limit(1),
      db
        .select()
        .from(geomagneticData)
        .where(eq(geomagneticData.userId, userId))
        .orderBy(desc(geomagneticData.timestamp))
        .limit(1),
      db
        .select()
        .from(pollenData)
        .where(eq(pollenData.userId, userId))
        .orderBy(desc(pollenData.timestamp))
        .limit(1),
    ]);

  const latest = latestRows[0];
  if (!latest) return null;

  const derivative = derivativeRows[0];
  const aqi = aqiRows[0];
  const geo = geoRows[0];
  const pollen = pollenRows[0];

  return {
    pressure: parseFloat(latest.pressure),
    temperature: parseFloat(latest.temperature),
    humidity: parseFloat(latest.humidity),
    windSpeed: parseFloat(latest.windSpeed),
    dewPoint: parseFloat(latest.dewPoint),
    uvIndex: parseFloat(latest.uvIndex),
    cloudCover: parseFloat(latest.cloudCover),
    precipitation: parseFloat(latest.precipitation),
    derivative: derivative
      ? {
          delta1h: parseFloat(derivative.delta1h),
          delta3h: parseFloat(derivative.delta3h),
          delta6h: parseFloat(derivative.delta6h),
          trend: derivative.trend,
        }
      : null,
    aqi: aqi
      ? {
          usAqi: parseFloat(aqi.usAqi),
          pm25: parseFloat(aqi.pm25),
          pm10: parseFloat(aqi.pm10),
          ozone: parseFloat(aqi.ozone),
          no2: parseFloat(aqi.no2),
          so2: parseFloat(aqi.so2),
          co: parseFloat(aqi.co),
        }
      : null,
    geomagnetic: geo
      ? {
          kpIndex: parseFloat(geo.kpIndex),
          solarWindSpeed: parseFloat(geo.solarWindSpeed),
          solarWindDensity: parseFloat(geo.solarWindDensity),
        }
      : null,
    pollen: pollen
      ? {
          treeIndex: pollen.treeIndex,
          grassIndex: pollen.grassIndex,
          weedIndex: pollen.weedIndex,
          moldIndex: pollen.moldIndex,
        }
      : null,
  };
}
