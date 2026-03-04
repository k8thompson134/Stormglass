export type EnvSeverity = 'low' | 'moderate' | 'high' | 'severe';

// Shared thresholds for classifying barometric pressure rate-of-change
// Values are absolute hPa/hour changes.
export const PRESSURE_RATE_THRESHOLDS = {
  moderate: 0.2,
  high: 0.5,
  severe: 1.0,
} as const;

export function classifyPressureRate(delta: number | null | undefined): EnvSeverity | null {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
  const abs = Math.abs(delta);
  if (abs >= PRESSURE_RATE_THRESHOLDS.severe) return 'severe';
  if (abs >= PRESSURE_RATE_THRESHOLDS.high) return 'high';
  if (abs >= PRESSURE_RATE_THRESHOLDS.moderate) return 'moderate';
  return 'low';
}

