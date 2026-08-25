import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  weatherData,
  pressureDerivatives,
  symptomLogs,
  airQualityData,
  geomagneticData,
  pollenData,
  users,
} from "../db/schema.js";
import { getCurrentConfig } from "../services/runtime-config.js";
import { fetchHyperlocalAQI } from "../services/purpleair.js";
import { analyzeSmokeTrend } from "../utils/smoke.js";
import {
  findSafeWindows,
  nextSafeWindow,
  findNextCategoryCrossing,
  getCategoryCeiling,
  CATEGORY_ORDER,
  type AqiCategory,
} from "../utils/aqiWindows.js";
import { summarizeAqiBurden } from "../utils/aqiBurden.js";

interface HistoryQuery {
  hours?: string;
}

interface AQIForecastQuery {
  threshold?: string;
  category?: string;
  hours?: string;
}

interface AQIBurdenQuery {
  days?: string;
  threshold?: string;
}

export async function weatherRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/weather/current — latest reading + derivative for default user
  app.get("/api/weather/current", async (request, reply) => {
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
      .where(
        location
          ? and(
              eq(weatherData.location, location),
              lte(weatherData.timestamp, now),
            )
          : lte(weatherData.timestamp, now),
      )
      .orderBy(desc(weatherData.timestamp))
      .limit(1);

    if (!latest) {
      return reply.status(404).send({ error: "No weather data available yet" });
    }

    const smokeWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const smokeWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Filter every sub-query by the SAME location as the winning weatherData row
    // (not just userId) -- a user who has reconfigured their location before leaves
    // old rows behind under other location strings, and userId-only filtering can
    // silently pick up a stale location's reading if its timestamps happen to
    // overlap with the current location's.
    const rowLocation = latest.location;

    // Parallelize the independent queries + live hyperlocal AQI overlay
    const [
      derivativeRows,
      aqiRows,
      geomagneticRows,
      pollenRows,
      hyperlocalAqi,
      smokePastRows,
      smokeFutureRows,
    ] = await Promise.all([
      db
        .select()
        .from(pressureDerivatives)
        .where(
          and(
            eq(pressureDerivatives.userId, latest.userId),
            eq(pressureDerivatives.location, rowLocation),
            lte(pressureDerivatives.timestamp, now),
          ),
        )
        .orderBy(desc(pressureDerivatives.timestamp))
        .limit(1),
      db
        .select()
        .from(airQualityData)
        .where(
          and(
            eq(airQualityData.userId, latest.userId),
            eq(airQualityData.location, rowLocation),
            lte(airQualityData.timestamp, now),
          ),
        )
        .orderBy(desc(airQualityData.timestamp))
        .limit(1),
      db
        .select()
        .from(geomagneticData)
        .where(
          and(
            eq(geomagneticData.userId, latest.userId),
            lte(geomagneticData.timestamp, now),
          ),
        )
        .orderBy(desc(geomagneticData.timestamp))
        .limit(1),
      db
        .select()
        .from(pollenData)
        .where(
          and(
            eq(pollenData.userId, latest.userId),
            eq(pollenData.location, rowLocation),
            lte(pollenData.timestamp, now),
          ),
        )
        .orderBy(desc(pollenData.timestamp))
        .limit(1),
      config
        ? fetchHyperlocalAQI(config.latitude, config.longitude)
        : Promise.resolve(null),
      db
        .select()
        .from(airQualityData)
        .where(
          and(
            eq(airQualityData.userId, latest.userId),
            eq(airQualityData.location, rowLocation),
            gte(airQualityData.timestamp, smokeWindowStart),
            lte(airQualityData.timestamp, now),
          ),
        )
        .orderBy(airQualityData.timestamp),
      db
        .select()
        .from(airQualityData)
        .where(
          and(
            eq(airQualityData.userId, latest.userId),
            eq(airQualityData.location, rowLocation),
            gte(airQualityData.timestamp, now),
            lte(airQualityData.timestamp, smokeWindowEnd),
          ),
        )
        .orderBy(airQualityData.timestamp),
    ]);

    const derivative = derivativeRows[0];
    const aqi = aqiRows[0];
    const geomagnetic = geomagneticRows[0];
    const pollen = pollenRows[0];

    const smokeTrend = analyzeSmokeTrend(
      smokePastRows.map((r) => ({
        timestamp: r.timestamp,
        pm25: parseFloat(r.pm25),
        pm10: parseFloat(r.pm10),
        no2: parseFloat(r.no2),
        so2: parseFloat(r.so2),
        usAqi: parseFloat(r.usAqi),
      })),
      smokeFutureRows.map((r) => ({
        timestamp: r.timestamp,
        pm25: parseFloat(r.pm25),
        pm10: parseFloat(r.pm10),
        no2: parseFloat(r.no2),
        so2: parseFloat(r.so2),
        usAqi: parseFloat(r.usAqi),
      })),
    );

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
      aqi: aqi
        ? {
            usAqi: parseFloat(aqi.usAqi),
            europeanAqi: parseFloat(aqi.europeanAqi),
            pm25: parseFloat(aqi.pm25),
            pm10: parseFloat(aqi.pm10),
            ozone: parseFloat(aqi.ozone),
            no2: parseFloat(aqi.no2),
            so2: parseFloat(aqi.so2),
            co: parseFloat(aqi.co),
            hyperlocal: hyperlocalAqi,
            smokeTrend,
          }
        : null,
      geomagnetic: geomagnetic
        ? {
            kpIndex: parseFloat(geomagnetic.kpIndex),
            solarWindSpeed: parseFloat(geomagnetic.solarWindSpeed),
            solarWindDensity: parseFloat(geomagnetic.solarWindDensity),
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
  });

  // GET /api/weather/history?hours=24 — pressure time-series
  app.get<{ Querystring: HistoryQuery }>(
    "/api/weather/history",
    async (request, reply) => {
      const hours = Math.min(parseInt(request.query.hours || "24", 10), 168);
      const now = new Date();
      const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

      // Cap forecast window proportional to history, max 48h (lair's crash-risk
      // forecast needs a 48h look-ahead for barometric drop detection)
      const forecastHours = Math.min(hours, 48);
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
          .where(
            location
              ? and(
                  gte(weatherData.timestamp, since),
                  lte(weatherData.timestamp, until),
                  eq(weatherData.location, location),
                )
              : and(
                  gte(weatherData.timestamp, since),
                  lte(weatherData.timestamp, until),
                ),
          )
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
          .where(
            location
              ? and(
                  gte(pressureDerivatives.timestamp, since),
                  lte(pressureDerivatives.timestamp, until),
                  eq(pressureDerivatives.location, location),
                )
              : and(
                  gte(pressureDerivatives.timestamp, since),
                  lte(pressureDerivatives.timestamp, until),
                ),
          )
          .orderBy(pressureDerivatives.timestamp)
          .limit(2000),

        db
          .select({
            timestamp: symptomLogs.timestamp,
            severity: symptomLogs.severity,
          })
          .from(symptomLogs)
          .where(
            and(
              gte(symptomLogs.timestamp, since),
              lte(symptomLogs.timestamp, until),
            ),
          )
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
          .where(
            location
              ? and(
                  gte(airQualityData.timestamp, since),
                  lte(airQualityData.timestamp, until),
                  eq(airQualityData.location, location),
                )
              : and(
                  gte(airQualityData.timestamp, since),
                  lte(airQualityData.timestamp, until),
                ),
          )
          .orderBy(airQualityData.timestamp)
          .limit(2000),
      ]);

      // Build maps for efficient merging
      const derivativeMap = new Map(
        derivatives.map((d) => [d.timestamp.toISOString(), d]),
      );

      // For symptoms, we use the closest hour or exact match
      const symptomMap = new Map(
        symptoms.map((s) => [s.timestamp.toISOString(), s.severity]),
      );

      const aqMap = new Map(
        aqReadings.map((a) => [a.timestamp.toISOString(), a]),
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
    },
  );

  // GET /api/weather/aqi-forecast — dedicated 72h AQI/PM2.5 forecast series.
  // The pressure history endpoint above caps its forecast window at 48h (pinned to
  // lair's crash-risk forecast needs), so this exposes the fuller 72h AQI forecast
  // that's already being fetched and stored by airquality.ts's forecast_days=3,
  // without disturbing that pressure-forecast contract.
  app.get<{ Querystring: AQIForecastQuery }>(
    "/api/weather/aqi-forecast",
    async (request, reply) => {
      const config = getCurrentConfig();
      const location = config ? `${config.latitude},${config.longitude}` : null;

      // `?category=` lets a caller ask for "safe below Unhealthy for Sensitive Groups"
      // in EPA terms rather than a bare number; it takes precedence over `?threshold=`
      // when both are given (and is well-formed) since the category name is the more
      // legible ask. Default threshold of 100 (US AQI "Moderate" ceiling) matches
      // AQI_CONFIG's line between "safe for most" and "sensitive groups should limit
      // exertion" -- the natural cutoff for "safe to go outside."
      const requestedCategory = CATEGORY_ORDER.find(
        (c) => c === request.query.category,
      ) as AqiCategory | undefined;
      const parsedThreshold = parseInt(request.query.threshold ?? "", 10);
      // `parsedThreshold || 100` would be wrong here -- a legitimately requested
      // ?threshold=0 is falsy in JS and would silently be overridden back to 100.
      const threshold = requestedCategory
        ? getCategoryCeiling(requestedCategory)
        : Math.max(
            0,
            Math.min(
              500,
              Number.isNaN(parsedThreshold) ? 100 : parsedThreshold,
            ),
          );

      // History lookback is configurable (matches /api/weather/history's ?hours=
      // pattern, same 6h/24h/48h/7d options as PressureChart) -- default 6h keeps the
      // smoke-trend/safe-window calcs' original small trailing window when no explicit
      // range is requested.
      const historyHours = Math.max(
        1,
        Math.min(168, parseInt(request.query.hours || "6", 10) || 6),
      );

      const now = new Date();
      const since = new Date(now.getTime() - historyHours * 60 * 60 * 1000);
      // The full 72h forecast is always fetched -- safeWindows/nextSafeWindow/
      // categoryCrossing must always reflect the complete outlook regardless of chart
      // zoom (you should still hear about smoke arriving in 3 days while looking at a
      // 6h chart). Only the *chart's own* series is scaled to the selected history
      // range below, mirroring PressureChart's forecastHours = min(hours, 48): a 6h
      // view pairs with a ~6h forecast window (a tight, legible zoom), a 7d view pairs
      // with the full 72h (the real ceiling of what Open-Meteo's forecast_days=3
      // fetch stores). Without this, the chart either wasted most of its width on
      // empty space (small hours, forecast off) or let a 72h forecast tail dwarf a
      // 6h sliver of real data (small hours, forecast on).
      const until = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const chartUntil = new Date(
        now.getTime() + Math.min(historyHours, 72) * 60 * 60 * 1000,
      );

      const rows = await db
        .select({
          timestamp: airQualityData.timestamp,
          usAqi: airQualityData.usAqi,
          pm25: airQualityData.pm25,
          pm10: airQualityData.pm10,
        })
        .from(airQualityData)
        .where(
          location
            ? and(
                gte(airQualityData.timestamp, since),
                lte(airQualityData.timestamp, until),
                eq(airQualityData.location, location),
              )
            : and(
                gte(airQualityData.timestamp, since),
                lte(airQualityData.timestamp, until),
              ),
        )
        .orderBy(airQualityData.timestamp)
        .limit(500);

      if (rows.length === 0) {
        return reply
          .status(404)
          .send({ error: "No air quality data available yet" });
      }

      // Chart series is trimmed to chartUntil (scaled to the requested history range);
      // safeWindows/categoryCrossing below still use the full `rows` (out to the real
      // 72h ceiling) so those callouts don't shrink along with the chart's zoom.
      const series = rows
        .filter((r) => r.timestamp <= chartUntil)
        .map((r) => ({
          timestamp: r.timestamp.toISOString(),
          usAqi: parseFloat(r.usAqi),
          pm25: parseFloat(r.pm25),
          pm10: parseFloat(r.pm10),
        }));

      const windowPoints = rows.map((r) => ({
        timestamp: r.timestamp,
        usAqi: parseFloat(r.usAqi),
      }));
      const safeWindows = findSafeWindows(windowPoints, threshold, now);
      const next = nextSafeWindow(safeWindows, now);

      const pastPoints = windowPoints.filter((p) => p.timestamp <= now);
      const currentPoint = pastPoints[pastPoints.length - 1] ?? windowPoints[0];
      const futurePoints = windowPoints.filter((p) => p.timestamp > now);
      const categoryCrossing = findNextCategoryCrossing(
        currentPoint.usAqi,
        futurePoints,
        now,
      );

      return {
        series,
        count: series.length,
        threshold,
        safeWindows: safeWindows.map((w) => ({
          start: w.start.toISOString(),
          end: w.end.toISOString(),
          durationHours: w.durationHours,
          avgAqi: w.avgAqi,
          maxAqi: w.maxAqi,
          isCurrent: w.isCurrent,
        })),
        nextSafeWindow: next
          ? {
              start: next.start.toISOString(),
              end: next.end.toISOString(),
              durationHours: next.durationHours,
              avgAqi: next.avgAqi,
              maxAqi: next.maxAqi,
              isCurrent: next.isCurrent,
            }
          : null,
        categoryCrossing: categoryCrossing
          ? {
              fromCategory: categoryCrossing.fromCategory,
              toCategory: categoryCrossing.toCategory,
              at: categoryCrossing.at.toISOString(),
              usAqi: categoryCrossing.usAqi,
            }
          : null,
      };
    },
  );

  // GET /api/weather/aqi-burden?days=90&threshold=100 — how much of the last N days
  // has actually been bad, cumulatively, so a slow-building season doesn't have to be
  // tracked by memory. Only looks at actual past readings (never forecast rows).
  app.get<{ Querystring: AQIBurdenQuery }>(
    "/api/weather/aqi-burden",
    async (request, reply) => {
      const config = getCurrentConfig();
      const location = config ? `${config.latitude},${config.longitude}` : null;

      const days = Math.max(
        1,
        Math.min(365, parseInt(request.query.days || "90", 10) || 90),
      );
      const parsedThreshold = parseInt(request.query.threshold ?? "", 10);
      const threshold = Math.max(
        0,
        Math.min(500, Number.isNaN(parsedThreshold) ? 100 : parsedThreshold),
      );

      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          timestamp: airQualityData.timestamp,
          usAqi: airQualityData.usAqi,
        })
        .from(airQualityData)
        .where(
          location
            ? and(
                eq(airQualityData.location, location),
                gte(airQualityData.timestamp, since),
                lte(airQualityData.timestamp, now),
              )
            : and(
                gte(airQualityData.timestamp, since),
                lte(airQualityData.timestamp, now),
              ),
        )
        .orderBy(airQualityData.timestamp)
        .limit(10_000);

      if (rows.length === 0) {
        return reply
          .status(404)
          .send({ error: "No air quality history available yet" });
      }

      // Group by the user's local calendar day, not UTC -- a reading at 11pm and one at
      // 2am the same local evening shouldn't count as two separate "days."
      let timeZone = "UTC";
      if (config) {
        const [userRow] = await db
          .select({ timezone: users.timezone })
          .from(users)
          .where(eq(users.id, config.userId))
          .limit(1);
        if (userRow?.timezone) timeZone = userRow.timezone;
      }

      const summary = summarizeAqiBurden(
        rows.map((r) => ({
          timestamp: r.timestamp,
          usAqi: parseFloat(r.usAqi),
        })),
        threshold,
        timeZone,
      );

      return { days, threshold, ...summary };
    },
  );
}
