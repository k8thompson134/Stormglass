import { eq, and, gte, lte, desc, asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import {
  symptomLogs,
  weatherData,
  pressureDerivatives,
  airQualityData,
  geomagneticData,
  pollenData,
} from '../db/schema.js';
import { getCurrentConfig } from '../jobs/weather-poll.js';
import {
  pearson,
  correlationConfidence,
  closestRow,
  extractValue,
  VARIABLE_META,
} from '../utils/correlations.js';

type EnvironmentalSnapshot = Record<string, any>;

interface CorrelationResult {
  insufficient_data: boolean;
  log_count?: number;
  days?: number;
  computed_at?: string;
  variables?: Record<string, VariableCorrelation>;
  top_correlations?: TopCorrelation[];
}

interface VariableCorrelation {
  label: string;
  unit: string;
  best_lag_hours: number;
  best_r: number | null;
  n: number;
  confidence: 'low' | 'medium' | 'high';
  lags: Array<{ lag_hours: number; r: number | null; n: number }>;
  high_severity_mean: number | null;
  low_severity_mean: number | null;
  high_severity_n: number;
  low_severity_n: number;
}

interface TopCorrelation {
  variable: string;
  label: string;
  r: number;
  lag_hours: number;
  direction: 'positive' | 'negative';
  confidence: 'low' | 'medium' | 'high';
  severity_delta: number | null;
  unit: string;
}

interface TimeseriesResponse {
  series: Array<Record<string, any>>;
  variables_meta: Record<string, { label: string; unit: string; color: string }>;
  days: number;
}

export async function correlationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/correlations?days=90
  app.get<{ Querystring: { days?: string } }>(
    '/api/correlations',
    async (request) => {
      const config = getCurrentConfig();
      if (!config) {
        return {
          insufficient_data: true,
          log_count: 0,
        };
      }

      const days = Math.min(
        Math.max(parseInt(request.query.days || '90', 10), 1),
        365
      );
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Fetch all symptom logs in the window
      const logs = await db
        .select()
        .from(symptomLogs)
        .where(
          and(
            eq(symptomLogs.userId, config.userId),
            gte(symptomLogs.timestamp, since)
          )
        )
        .orderBy(asc(symptomLogs.timestamp));

      // Filter to logs with non-null snapshots
      const usableLogs = logs.filter(
        (l): l is typeof logs[0] & { environmentalSnapshot: EnvironmentalSnapshot } =>
          l.environmentalSnapshot !== null && typeof l.environmentalSnapshot === 'object'
      );

      if (usableLogs.length < 5) {
        return {
          insufficient_data: true,
          log_count: logs.length,
        };
      }

      const minTs = usableLogs[0].timestamp;
      const maxTs = usableLogs[usableLogs.length - 1].timestamp;
      const rangeStart = new Date(minTs.getTime() - 6 * 60 * 60 * 1000);

      // Bulk-fetch all environmental tables
      const [weatherRows, derivativeRows, aqiRows, geoRows, pollenRows] =
        await Promise.all([
          db
            .select()
            .from(weatherData)
            .where(
              and(
                eq(weatherData.userId, config.userId),
                gte(weatherData.timestamp, rangeStart),
                lte(weatherData.timestamp, maxTs)
              )
            )
            .orderBy(asc(weatherData.timestamp)),
          db
            .select()
            .from(pressureDerivatives)
            .where(
              and(
                eq(pressureDerivatives.userId, config.userId),
                gte(pressureDerivatives.timestamp, rangeStart),
                lte(pressureDerivatives.timestamp, maxTs)
              )
            )
            .orderBy(asc(pressureDerivatives.timestamp)),
          db
            .select()
            .from(airQualityData)
            .where(
              and(
                eq(airQualityData.userId, config.userId),
                gte(airQualityData.timestamp, rangeStart),
                lte(airQualityData.timestamp, maxTs)
              )
            )
            .orderBy(asc(airQualityData.timestamp)),
          db
            .select()
            .from(geomagneticData)
            .where(
              and(
                eq(geomagneticData.userId, config.userId),
                gte(geomagneticData.timestamp, rangeStart),
                lte(geomagneticData.timestamp, maxTs)
              )
            )
            .orderBy(asc(geomagneticData.timestamp)),
          db
            .select()
            .from(pollenData)
            .where(
              and(
                eq(pollenData.userId, config.userId),
                gte(pollenData.timestamp, rangeStart),
                lte(pollenData.timestamp, maxTs)
              )
            )
            .orderBy(asc(pollenData.timestamp)),
        ]);

      // Compute correlations for each variable
      const variables: Record<string, VariableCorrelation> = {};
      const allCorrelations: TopCorrelation[] = [];

      const lagHours = [0, 1, 2, 3, 6];

      // Pressure
      computeVariableCorrelation(
        'pressure',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.pressure);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(weatherRows, target);
          return row ? extractValue(row.pressure) : null;
        }
      );

      // Delta 1h
      computeVariableCorrelation(
        'delta1h',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0)
            return extractValue(log.environmentalSnapshot?.derivative?.delta1h);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(derivativeRows, target);
          return row ? extractValue(row.delta1h) : null;
        }
      );

      // Temperature
      computeVariableCorrelation(
        'temperature',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.temperature);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(weatherRows, target);
          return row ? extractValue(row.temperature) : null;
        }
      );

      // Humidity
      computeVariableCorrelation(
        'humidity',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.humidity);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(weatherRows, target);
          return row ? extractValue(row.humidity) : null;
        }
      );

      // US AQI
      computeVariableCorrelation(
        'usAqi',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.aqi?.usAqi);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(aqiRows, target);
          return row ? extractValue(row.usAqi) : null;
        }
      );

      // PM2.5
      computeVariableCorrelation(
        'pm25',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.aqi?.pm25);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(aqiRows, target);
          return row ? extractValue(row.pm25) : null;
        }
      );

      // Kp Index
      computeVariableCorrelation(
        'kpIndex',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.geomagnetic?.kpIndex);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(geoRows, target);
          return row ? extractValue(row.kpIndex) : null;
        }
      );

      // Tree Index
      computeVariableCorrelation(
        'treeIndex',
        usableLogs,
        variables,
        lagHours,
        (log, lag) => {
          if (lag === 0) return extractValue(log.environmentalSnapshot?.pollen?.treeIndex);
          const target = log.timestamp.getTime() - lag * 60 * 60 * 1000;
          const row = closestRow(pollenRows, target);
          return row ? extractValue(row.treeIndex) : null;
        }
      );

      // Build top_correlations from all variables
      for (const [varKey, varData] of Object.entries(variables)) {
        if (
          varData.best_r !== null &&
          varData.confidence !== 'low' &&
          Math.abs(varData.best_r) >= 0.3
        ) {
          const meta = VARIABLE_META[varKey];
          allCorrelations.push({
            variable: varKey,
            label: meta.label,
            r: varData.best_r,
            lag_hours: varData.best_lag_hours,
            direction: varData.best_r > 0 ? 'positive' : 'negative',
            confidence: varData.confidence,
            severity_delta:
              varData.high_severity_mean !== null &&
              varData.low_severity_mean !== null
                ? varData.high_severity_mean - varData.low_severity_mean
                : null,
            unit: meta.unit,
          });
        }
      }

      allCorrelations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

      return {
        insufficient_data: false,
        log_count: usableLogs.length,
        days,
        computed_at: new Date().toISOString(),
        variables,
        top_correlations: allCorrelations,
      };
    }
  );

  // GET /api/correlations/timeseries?days=90&variables=pressure,kpIndex
  app.get<{ Querystring: { days?: string; variables?: string } }>(
    '/api/correlations/timeseries',
    async (request) => {
      const config = getCurrentConfig();
      if (!config) {
        return {
          series: [],
          variables_meta: {},
          days: 0,
        };
      }

      const days = Math.min(
        Math.max(parseInt(request.query.days || '90', 10), 1),
        365
      );
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const varKeys = (request.query.variables || 'pressure')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v in VARIABLE_META);

      if (varKeys.length === 0) {
        return {
          series: [],
          variables_meta: {},
          days,
        };
      }

      // Fetch all data needed for timeseries
      const [logRows, weatherRows, derivativeRows, aqiRows, geoRows, pollenRows] =
        await Promise.all([
          db
            .select()
            .from(symptomLogs)
            .where(
              and(
                eq(symptomLogs.userId, config.userId),
                gte(symptomLogs.timestamp, since)
              )
            )
            .orderBy(asc(symptomLogs.timestamp)),
          db
            .select()
            .from(weatherData)
            .where(
              and(
                eq(weatherData.userId, config.userId),
                gte(weatherData.timestamp, since)
              )
            )
            .orderBy(asc(weatherData.timestamp)),
          db
            .select()
            .from(pressureDerivatives)
            .where(
              and(
                eq(pressureDerivatives.userId, config.userId),
                gte(pressureDerivatives.timestamp, since)
              )
            )
            .orderBy(asc(pressureDerivatives.timestamp)),
          db
            .select()
            .from(airQualityData)
            .where(
              and(
                eq(airQualityData.userId, config.userId),
                gte(airQualityData.timestamp, since)
              )
            )
            .orderBy(asc(airQualityData.timestamp)),
          db
            .select()
            .from(geomagneticData)
            .where(
              and(
                eq(geomagneticData.userId, config.userId),
                gte(geomagneticData.timestamp, since)
              )
            )
            .orderBy(asc(geomagneticData.timestamp)),
          db
            .select()
            .from(pollenData)
            .where(
              and(
                eq(pollenData.userId, config.userId),
                gte(pollenData.timestamp, since)
              )
            )
            .orderBy(asc(pollenData.timestamp)),
        ]);

      // Aggregate to daily granularity
      const dailyMap = new Map<
        string,
        {
          date: string;
          severity_max: number | null;
          severity_sum: number;
          severity_count: number;
          log_count: number;
          [key: string]: any;
        }
      >();

      // Add symptom logs
      for (const log of logRows) {
        const date = toUTCDateString(log.timestamp);
        const entry = dailyMap.get(date) || {
          date,
          severity_max: null,
          severity_sum: 0,
          severity_count: 0,
          log_count: 0,
        };
        entry.severity_max =
          entry.severity_max !== null
            ? Math.max(entry.severity_max, log.severity)
            : log.severity;
        entry.severity_sum += log.severity;
        entry.severity_count += 1;
        entry.log_count += 1;
        dailyMap.set(date, entry);
      }

      // Add environmental variables (daily means for most, daily max for delta1h)
      for (const varKey of varKeys) {
        if (varKey === 'pressure') {
          dailyAggregate(
            'pressure',
            weatherRows,
            dailyMap,
            (row) => extractValue(row.pressure),
            'mean'
          );
        } else if (varKey === 'delta1h') {
          dailyAggregate(
            'delta1h',
            derivativeRows,
            dailyMap,
            (row) => extractValue(row.delta1h),
            'max_abs'
          );
        } else if (varKey === 'temperature') {
          dailyAggregate(
            'temperature',
            weatherRows,
            dailyMap,
            (row) => extractValue(row.temperature),
            'mean'
          );
        } else if (varKey === 'humidity') {
          dailyAggregate(
            'humidity',
            weatherRows,
            dailyMap,
            (row) => extractValue(row.humidity),
            'mean'
          );
        } else if (varKey === 'usAqi') {
          dailyAggregate(
            'usAqi',
            aqiRows,
            dailyMap,
            (row) => extractValue(row.usAqi),
            'mean'
          );
        } else if (varKey === 'pm25') {
          dailyAggregate(
            'pm25',
            aqiRows,
            dailyMap,
            (row) => extractValue(row.pm25),
            'mean'
          );
        } else if (varKey === 'kpIndex') {
          dailyAggregate(
            'kpIndex',
            geoRows,
            dailyMap,
            (row) => extractValue(row.kpIndex),
            'mean'
          );
        } else if (varKey === 'treeIndex') {
          dailyAggregate(
            'treeIndex',
            pollenRows,
            dailyMap,
            (row) => extractValue(row.treeIndex),
            'mean'
          );
        }
      }

      // Convert to array and finalize
      const series = Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => {
          const result: Record<string, any> = {
            date: entry.date,
            severity_max: entry.severity_max,
            severity_mean:
              entry.severity_count > 0
                ? entry.severity_sum / entry.severity_count
                : null,
            log_count: entry.log_count,
          };
          for (const varKey of varKeys) {
            result[varKey] = entry[varKey] ?? null;
          }
          return result;
        });

      const variables_meta: Record<
        string,
        { label: string; unit: string; color: string }
      > = {};
      for (const varKey of varKeys) {
        variables_meta[varKey] = VARIABLE_META[varKey];
      }

      return {
        series,
        variables_meta,
        days,
      };
    }
  );
}

/**
 * Helper: compute Pearson correlation for a variable across multiple lags.
 */
function computeVariableCorrelation(
  varKey: string,
  logs: Array<any>,
  variables: Record<string, VariableCorrelation>,
  lagHours: number[],
  extractor: (log: any, lag: number) => number | null
): void {
  const meta = VARIABLE_META[varKey];
  const severities = logs.map((l) => l.severity);

  const lags: Array<{ lag_hours: number; r: number | null; n: number }> = [];
  let bestLag = 0;
  let bestR: number | null = null;
  let bestN = 0;

  for (const lag of lagHours) {
    const values = logs.map((log) => extractor(log, lag));
    const pairs = logs
      .map((log, i) => ({ severity: log.severity, value: values[i] }))
      .filter((p) => p.value !== null);

    const r = pairs.length >= 2 ? pearson(
      pairs.map((p) => p.value!),
      pairs.map((p) => p.severity)
    ) : null;

    lags.push({ lag_hours: lag, r, n: pairs.length });

    if (
      r !== null &&
      (bestR === null || Math.abs(r) > Math.abs(bestR))
    ) {
      bestR = r;
      bestLag = lag;
      bestN = pairs.length;
    }
  }

  // High vs low severity means
  const highSevLogs = logs.filter((l) => l.severity >= 7);
  const lowSevLogs = logs.filter((l) => l.severity <= 3);

  let highSevMean: number | null = null;
  let lowSevMean: number | null = null;

  if (highSevLogs.length > 0) {
    const highValues = highSevLogs
      .map((l) => extractor(l, 0))
      .filter((v) => v !== null) as number[];
    if (highValues.length > 0) {
      highSevMean = highValues.reduce((a, b) => a + b) / highValues.length;
    }
  }

  if (lowSevLogs.length > 0) {
    const lowValues = lowSevLogs
      .map((l) => extractor(l, 0))
      .filter((v) => v !== null) as number[];
    if (lowValues.length > 0) {
      lowSevMean = lowValues.reduce((a, b) => a + b) / lowValues.length;
    }
  }

  variables[varKey] = {
    label: meta.label,
    unit: meta.unit,
    best_lag_hours: bestLag,
    best_r: bestR,
    n: bestN,
    confidence: correlationConfidence(bestR, bestN),
    lags,
    high_severity_mean: highSevMean,
    low_severity_mean: lowSevMean,
    high_severity_n: highSevLogs.length,
    low_severity_n: lowSevLogs.length,
  };
}

/**
 * Helper: aggregate environmental data to daily level.
 */
function dailyAggregate<T extends { timestamp: Date }>(
  varKey: string,
  rows: T[],
  dailyMap: Map<string, Record<string, any>>,
  extractor: (row: T) => number | null,
  aggregation: 'mean' | 'max_abs'
): void {
  const dailyValues = new Map<string, number[]>();

  for (const row of rows) {
    const date = toUTCDateString(row.timestamp);
    const value = extractor(row);
    if (value !== null) {
      if (!dailyValues.has(date)) {
        dailyValues.set(date, []);
      }
      dailyValues.get(date)!.push(value);
    }
  }

  for (const [date, values] of dailyValues) {
    if (values.length === 0) continue;

    let aggregated: number;
    if (aggregation === 'mean') {
      aggregated = values.reduce((a, b) => a + b) / values.length;
    } else {
      // max_abs: largest absolute change (for delta1h)
      aggregated = Math.max(...values.map((v) => Math.abs(v)));
    }

    const entry = dailyMap.get(date);
    if (entry) {
      entry[varKey] = aggregated;
    } else {
      const newEntry: Record<string, any> = {
        date,
        severity_max: null,
        severity_sum: 0,
        severity_count: 0,
        log_count: 0,
        [varKey]: aggregated,
      };
      dailyMap.set(date, newEntry);
    }
  }
}

/**
 * Helper: convert a Date to UTC date string (YYYY-MM-DD).
 */
function toUTCDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
