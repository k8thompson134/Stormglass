import { eq, desc, and, gte, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { weatherData, pressureDerivatives, airQualityData, geomagneticData, pollenData } from '../db/schema.js';
import { getCurrentConfig } from '../jobs/weather-poll.js';
import { analyzeSmokeTrend } from '../utils/smoke.js';
import { fetchHyperlocalAQI } from '../services/purpleair.js';
import {
  getMigraineRisk,
  getMECFSRisk,
  getGeomagneticRisk,
  getAQIRisk,
  getPOTSRisk,
  getJointPainRisk,
  getPollenRisk,
} from '../utils/healthLogic.js';
import type { RiskLevel } from '../utils/healthTypes.js';

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, severe: 3 };

function highestRisk(levels: RiskLevel[]): RiskLevel {
  return levels.reduce((max, r) => RISK_ORDER[r] > RISK_ORDER[max] ? r : max, 'low' as RiskLevel);
}

function secondsSince(ts: Date | null | undefined): number | null {
  if (!ts) return null;
  return Math.round((Date.now() - ts.getTime()) / 1000);
}

export async function briefingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/briefing', async (request, reply) => {
    const config = getCurrentConfig();
    const location = config ? `${config.latitude},${config.longitude}` : null;

    const now = new Date();

    // weatherData (and airQualityData) also store forecast rows up to several days
    // out, so "ORDER BY timestamp DESC" alone would return the far-future forecast
    // tail instead of the actual latest reading -- every "latest" lookup below is
    // bounded to timestamp <= now for that reason.
    const [latest] = await db
      .select()
      .from(weatherData)
      .where(location
        ? and(eq(weatherData.location, location), lte(weatherData.timestamp, now))
        : lte(weatherData.timestamp, now))
      .orderBy(desc(weatherData.timestamp))
      .limit(1);

    if (!latest) {
      return reply.status(404).send({ error: 'No weather data available yet' });
    }

    const smokeWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const smokeWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Filter every sub-query by the SAME location as the winning weatherData row
    // (not just userId) -- a user who has reconfigured their location before leaves
    // old rows behind under other location strings, and userId-only filtering can
    // silently pick up a stale location's reading if its timestamps happen to
    // overlap with the current location's.
    const rowLocation = latest.location;

    const [derivativeRows, aqiRows, geomagneticRows, pollenRows, hyperlocalAqi, smokePastRows, smokeFutureRows] = await Promise.all([
      db.select().from(pressureDerivatives)
        .where(and(eq(pressureDerivatives.userId, latest.userId), eq(pressureDerivatives.location, rowLocation), lte(pressureDerivatives.timestamp, now)))
        .orderBy(desc(pressureDerivatives.timestamp)).limit(1),
      db.select().from(airQualityData)
        .where(and(eq(airQualityData.userId, latest.userId), eq(airQualityData.location, rowLocation), lte(airQualityData.timestamp, now)))
        .orderBy(desc(airQualityData.timestamp)).limit(1),
      db.select().from(geomagneticData)
        .where(and(eq(geomagneticData.userId, latest.userId), lte(geomagneticData.timestamp, now)))
        .orderBy(desc(geomagneticData.timestamp)).limit(1),
      db.select().from(pollenData)
        .where(and(eq(pollenData.userId, latest.userId), eq(pollenData.location, rowLocation), lte(pollenData.timestamp, now)))
        .orderBy(desc(pollenData.timestamp)).limit(1),
      config ? fetchHyperlocalAQI(config.latitude, config.longitude) : Promise.resolve(null),
      db.select().from(airQualityData)
        .where(and(
          eq(airQualityData.userId, latest.userId),
          eq(airQualityData.location, rowLocation),
          gte(airQualityData.timestamp, smokeWindowStart),
          lte(airQualityData.timestamp, now)
        ))
        .orderBy(airQualityData.timestamp),
      db.select().from(airQualityData)
        .where(and(
          eq(airQualityData.userId, latest.userId),
          eq(airQualityData.location, rowLocation),
          gte(airQualityData.timestamp, now),
          lte(airQualityData.timestamp, smokeWindowEnd)
        ))
        .orderBy(airQualityData.timestamp),
    ]);

    const derivative = derivativeRows[0] ?? null;
    const aqi = aqiRows[0] ?? null;
    const geomagnetic = geomagneticRows[0] ?? null;
    const pollen = pollenRows[0] ?? null;

    const smokeTrend = analyzeSmokeTrend(
      smokePastRows.map(r => ({
        timestamp: r.timestamp,
        pm25: parseFloat(r.pm25),
        pm10: parseFloat(r.pm10),
        no2: parseFloat(r.no2),
        so2: parseFloat(r.so2),
        usAqi: parseFloat(r.usAqi),
      })),
      smokeFutureRows.map(r => ({
        timestamp: r.timestamp,
        pm25: parseFloat(r.pm25),
        pm10: parseFloat(r.pm10),
        no2: parseFloat(r.no2),
        so2: parseFloat(r.so2),
        usAqi: parseFloat(r.usAqi),
      }))
    );

    // Parse numeric fields
    const pressure = parseFloat(latest.pressure);
    const temp = parseFloat(latest.temperature);
    const humidity = parseFloat(latest.humidity);
    const delta1h = derivative ? parseFloat(derivative.delta1h) : 0;
    const delta3h = derivative ? parseFloat(derivative.delta3h) : 0;
    const delta6h = derivative ? parseFloat(derivative.delta6h) : 0;

    const aqiInput = aqi ? {
      usAqi: parseFloat(aqi.usAqi),
      pm25: parseFloat(aqi.pm25),
      pm10: parseFloat(aqi.pm10),
      ozone: parseFloat(aqi.ozone),
      no2: parseFloat(aqi.no2),
      so2: parseFloat(aqi.so2),
      co: parseFloat(aqi.co),
      hyperlocal: hyperlocalAqi,
      smokeTrend,
    } : null;

    const geoInput = geomagnetic ? {
      kpIndex: parseFloat(geomagnetic.kpIndex),
      solarWindSpeed: parseFloat(geomagnetic.solarWindSpeed),
      solarWindDensity: parseFloat(geomagnetic.solarWindDensity),
    } : null;

    const pollenInput = pollen ? {
      treeIndex: pollen.treeIndex,
      grassIndex: pollen.grassIndex,
      weedIndex: pollen.weedIndex,
      moldIndex: pollen.moldIndex,
    } : null;

    // Use the worse of model vs. hyperlocal (same rule getAQIRisk uses) -- otherwise
    // these contributing factors miss exactly the local smoke plume the hyperlocal
    // sensor exists to catch.
    const currentAqi = aqiInput
      ? (aqiInput.hyperlocal ? Math.max(aqiInput.usAqi, aqiInput.hyperlocal.usAqi) : aqiInput.usAqi)
      : null;

    // Compute all 7 health risks
    const risks = [
      getMigraineRisk(delta1h, currentAqi),
      getMECFSRisk(delta1h, delta3h, delta6h, currentAqi),
      getPOTSRisk(delta1h, humidity, temp, currentAqi),
      getJointPainRisk(delta1h, humidity, temp, currentAqi),
      getAQIRisk(aqiInput),
      getGeomagneticRisk(geoInput),
      getPollenRisk(pollenInput),
    ];

    const overallRisk = highestRisk(risks.map(r => r.risk));

    return {
      meta: {
        timestamp: latest.timestamp,
        location: {
          lat: parseFloat(config?.latitude ?? latest.location.split(',')[0]),
          lon: parseFloat(config?.longitude ?? latest.location.split(',')[1]),
          name: config?.name ?? null,
        },
        dataAge: {
          weatherSec: secondsSince(latest.timestamp),
          aqiSec: secondsSince(aqi?.timestamp),
          geomagneticSec: secondsSince(geomagnetic?.timestamp),
          pollenSec: secondsSince(pollen?.timestamp),
        },
      },
      conditions: {
        pressure: {
          hPa: pressure,
          delta1h,
          delta3h,
          delta6h,
          trend: derivative?.trend ?? null,
        },
        weather: {
          tempC: temp,
          humidity,
          windMs: parseFloat(latest.windSpeed),
          uvIndex: parseFloat(latest.uvIndex),
          precipMm: parseFloat(latest.precipitation),
        },
        aqi: aqiInput,
        geomagnetic: geoInput ? { kpIndex: geoInput.kpIndex, solarWindKms: geoInput.solarWindSpeed } : null,
        pollen: pollenInput,
      },
      risks,
      overallRisk,
    };
  });
}
