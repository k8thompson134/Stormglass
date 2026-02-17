import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { weatherData, pressureDerivatives, symptomLogs, airQualityData, geomagneticData, pollenData } from '../db/schema.js';
import { getCurrentConfig } from '../jobs/weather-poll.js';

interface HistoryQuery {
  hours?: string;
}

export async function weatherRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/weather/current — latest reading + derivative for default user
  app.get('/api/weather/current', async (request, reply) => {
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

    // Parallelize the 4 independent queries
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

    const derivative = derivativeRows[0];
    const aqi = aqiRows[0];
    const geomagnetic = geomagneticRows[0];
    const pollen = pollenRows[0];

    return {
      timestamp: latest.timestamp,
      pressure: parseFloat(latest.pressure),
      temperature: parseFloat(latest.temperature),
      humidity: parseFloat(latest.humidity),
      windSpeed: parseFloat(latest.windSpeed),
      windDirection: parseFloat(latest.windDirection),
      uvIndex: parseFloat(latest.uvIndex),
      cloudCover: parseFloat(latest.cloudCover),
      precipitation: parseFloat(latest.precipitation),
      dewPoint: parseFloat(latest.dewPoint),
      derivative: derivative
        ? {
          delta1h: parseFloat(derivative.delta1h),
          delta3h: parseFloat(derivative.delta3h),
          delta6h: parseFloat(derivative.delta6h),
          trend: derivative.trend,
        }
        : null,
      aqi: aqi ? {
        usAqi: parseFloat(aqi.usAqi),
        europeanAqi: parseFloat(aqi.europeanAqi),
        pm25: parseFloat(aqi.pm25),
        pm10: parseFloat(aqi.pm10),
        ozone: parseFloat(aqi.ozone),
        no2: parseFloat(aqi.no2),
        so2: parseFloat(aqi.so2),
        co: parseFloat(aqi.co),
      } : null,
      geomagnetic: geomagnetic ? {
        kpIndex: parseFloat(geomagnetic.kpIndex),
        solarWindSpeed: parseFloat(geomagnetic.solarWindSpeed),
        solarWindDensity: parseFloat(geomagnetic.solarWindDensity),
      } : null,
      pollen: pollen ? {
        treeIndex: pollen.treeIndex,
        grassIndex: pollen.grassIndex,
        weedIndex: pollen.weedIndex,
        moldIndex: pollen.moldIndex,
      } : null,
    };
  });

  // GET /api/weather/history?hours=24 — pressure time-series
  app.get<{ Querystring: HistoryQuery }>(
    '/api/weather/history',
    async (request, reply) => {
      const hours = Math.min(parseInt(request.query.hours || '24', 10), 168);
      const now = new Date();
      const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

      // Cap forecast window proportional to history, max 24h
      const forecastHours = Math.min(hours, 24);
      const until = new Date(now.getTime() + forecastHours * 60 * 60 * 1000);

      const config = getCurrentConfig();
      const location = config ? `${config.latitude},${config.longitude}` : null;

      const [readings, derivatives, symptoms, aqReadings] = await Promise.all([
        db
          .select({
            timestamp: weatherData.timestamp,
            pressure: weatherData.pressure,
            temperature: weatherData.temperature,
            humidity: weatherData.humidity,
          })
          .from(weatherData)
          .where(location
            ? and(gte(weatherData.timestamp, since), lte(weatherData.timestamp, until), eq(weatherData.location, location))
            : and(gte(weatherData.timestamp, since), lte(weatherData.timestamp, until)))
          .orderBy(weatherData.timestamp)
          .limit(2000),

        db
          .select({
            timestamp: pressureDerivatives.timestamp,
            delta1h: pressureDerivatives.delta1h,
            delta3h: pressureDerivatives.delta3h,
            delta6h: pressureDerivatives.delta6h,
            trend: pressureDerivatives.trend,
          })
          .from(pressureDerivatives)
          .where(location
            ? and(gte(pressureDerivatives.timestamp, since), lte(pressureDerivatives.timestamp, until), eq(pressureDerivatives.location, location))
            : and(gte(pressureDerivatives.timestamp, since), lte(pressureDerivatives.timestamp, until)))
          .orderBy(pressureDerivatives.timestamp)
          .limit(2000),

        db
          .select({
            timestamp: symptomLogs.timestamp,
            severity: symptomLogs.severity,
          })
          .from(symptomLogs)
          .where(and(gte(symptomLogs.timestamp, since), lte(symptomLogs.timestamp, until)))
          .orderBy(symptomLogs.timestamp)
          .limit(2000),

        db
          .select({
            timestamp: airQualityData.timestamp,
            usAqi: airQualityData.usAqi,
            pm25: airQualityData.pm25,
            pm10: airQualityData.pm10,
          })
          .from(airQualityData)
          .where(location
            ? and(gte(airQualityData.timestamp, since), lte(airQualityData.timestamp, until), eq(airQualityData.location, location))
            : and(gte(airQualityData.timestamp, since), lte(airQualityData.timestamp, until)))
          .orderBy(airQualityData.timestamp)
          .limit(2000),
      ]);

      // Build maps for efficient merging
      const derivativeMap = new Map(
        derivatives.map((d) => [d.timestamp.toISOString(), d])
      );

      // For symptoms, we use the closest hour or exact match
      const symptomMap = new Map(
        symptoms.map((s) => [s.timestamp.toISOString(), s.severity])
      );

      const aqMap = new Map(
        aqReadings.map((a) => [a.timestamp.toISOString(), a])
      );

      // Merge into a single time-series array for Recharts
      const series = readings.map((r) => {
        const isoTs = r.timestamp.toISOString();
        const d = derivativeMap.get(isoTs);
        const s = symptomMap.get(isoTs);
        const a = aqMap.get(isoTs);

        return {
          timestamp: isoTs,
          pressure: parseFloat(r.pressure),
          temperature: parseFloat(r.temperature),
          humidity: parseFloat(r.humidity),
          delta1h: d ? parseFloat(d.delta1h) : null,
          trend: d ? d.trend : null,
          symptomSeverity: s ?? null,
          usAqi: a ? parseFloat(a.usAqi) : null,
          pm25: a ? parseFloat(a.pm25) : null,
        };
      });

      return { series, count: series.length };
    }
  );
}
