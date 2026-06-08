/**
 * Pearson correlation between two equal-length arrays of numbers.
 * Returns null if n < 2, if either array has zero variance, or if inputs contain NaN/Infinity.
 */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n !== ys.length || n < 2) return null;

  let sumX = 0,
    sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let cov = 0,
    varX = 0,
    varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) return null;
  const r = cov / Math.sqrt(varX * varY);
  return Math.max(-1, Math.min(1, r));
}

/**
 * Classify a correlation strength for display based on Pearson r and sample size.
 * n < 8 is always 'low' regardless of r (statistical unreliability).
 */
export function correlationConfidence(
  r: number | null,
  n: number
): 'low' | 'medium' | 'high' {
  if (r === null || n < 8) return 'low';
  const abs = Math.abs(r);
  if (abs >= 0.5 && n >= 15) return 'high';
  if (abs >= 0.3) return 'medium';
  return 'low';
}

/**
 * Find the closest row in a timestamp-sorted array to a target timestamp.
 * Returns null if the closest is farther than toleranceMs (default 2 hours).
 */
export function closestRow<T extends { timestamp: Date }>(
  rows: T[],
  targetMs: number,
  toleranceMs = 2 * 60 * 60 * 1000 // 2 hours
): T | null {
  if (rows.length === 0) return null;

  // Binary search for insertion point
  let lo = 0,
    hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].timestamp.getTime() < targetMs) lo = mid + 1;
    else hi = mid;
  }

  // Check both lo and lo-1 to find globally closest
  const candidates: T[] = [rows[lo]];
  if (lo > 0) candidates.push(rows[lo - 1]);

  const best = candidates.reduce((a, b) =>
    Math.abs(a.timestamp.getTime() - targetMs) <=
    Math.abs(b.timestamp.getTime() - targetMs)
      ? a
      : b
  );

  const delta = Math.abs(best.timestamp.getTime() - targetMs);
  return delta <= toleranceMs ? best : null;
}

/**
 * Extract a numeric value from an environmental snapshot or row.
 * Returns null if the value is missing, NaN, or Infinity.
 */
export function extractValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

/**
 * Map variable keys to human-readable labels and units.
 */
export const VARIABLE_META: Record<
  string,
  { label: string; unit: string; color: string }
> = {
  pressure: {
    label: 'Pressure (hPa)',
    unit: 'hPa',
    color: '#818cf8',
  },
  delta1h: {
    label: 'Pressure Change (1h)',
    unit: 'hPa/h',
    color: '#a78bfa',
  },
  temperature: {
    label: 'Temperature (°C)',
    unit: '°C',
    color: '#fb923c',
  },
  humidity: {
    label: 'Humidity (%)',
    unit: '%',
    color: '#38bdf8',
  },
  usAqi: {
    label: 'US Air Quality Index',
    unit: 'AQI',
    color: '#fbbf24',
  },
  pm25: {
    label: 'PM2.5 (µg/m³)',
    unit: 'µg/m³',
    color: '#f97316',
  },
  kpIndex: {
    label: 'Geomagnetic Activity (Kp)',
    unit: 'Kp',
    color: '#e879f9',
  },
  treeIndex: {
    label: 'Tree Pollen Index',
    unit: 'Index',
    color: '#4ade80',
  },
};
