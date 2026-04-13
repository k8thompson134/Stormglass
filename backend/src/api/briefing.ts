import { eq, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { weatherData, pressureDerivatives, airQualityData, geomagneticData, pollenData } from '../db/schema.js';
import { getCurrentConfig } from '../jobs/weather-poll.js';
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

    const [latest] = await db
      .select()
      .from(weatherData)
      .where(location ? eq(weatherData.location, location) : undefined)
      .orderBy(desc(weatherData.timestamp))
      .limit(1);

    if (!latest) {
      return reply.status(404).send({ error: 'No weather data available yet' });
    }

    const [derivativeRows, aqiRows, geomagneticRows, pollenRows] = await Promise.all([
      db.select().from(pressureDerivatives)
        .where(eq(pressureDerivatives.userId, latest.userId))
        .orderBy(desc(pressureDerivatives.timestamp)).limit(1),
      db.select().from(airQualityData)
        .where(eq(airQualityData.userId, latest.userId))
        .orderBy(desc(airQualityData.timestamp)).limit(1),
      db.select().from(geomagneticData)
        .where(eq(geomagneticData.userId, latest.userId))
        .orderBy(desc(geomagneticData.timestamp)).limit(1),
      db.select().from(pollenData)
        .where(eq(pollenData.userId, latest.userId))
        .orderBy(desc(pollenData.timestamp)).limit(1),
    ]);

    const derivative = derivativeRows[0] ?? null;
    const aqi = aqiRows[0] ?? null;
    const geomagnetic = geomagneticRows[0] ?? null;
    const pollen = pollenRows[0] ?? null;

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

    // Compute all 7 health risks
    const risks = [
      getMigraineRisk(delta1h),
      getMECFSRisk(delta1h, delta3h, delta6h),
      getPOTSRisk(delta1h, humidity, temp),
      getJointPainRisk(delta1h, humidity, temp),
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
          humidity: parseFloat(latest.humidity),
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
