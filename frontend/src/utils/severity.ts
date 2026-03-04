export type EnvSeverity = 'low' | 'moderate' | 'high' | 'severe';

/** Single source of truth for severity → colors across CurrentConditions, PressureChart, HealthImpact */
export const SEVERITY_THEME: Record<EnvSeverity, {
  badge: { bg: string; text: string; border: string; shadow: string };
  chartFill: string;
  pill: string;
  chip: string;
}> = {
  low: {
    badge: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', shadow: 'shadow-glow-emerald' },
    chartFill: '#34d399',
    pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    chip: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  },
  moderate: {
    badge: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', shadow: 'shadow-glow-amber' },
    chartFill: '#f59e0b',
    pill: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    chip: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  },
  high: {
    badge: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30', shadow: 'shadow-glow-amber' },
    chartFill: '#f97316',
    pill: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
    chip: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  },
  severe: {
    badge: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', shadow: 'shadow-glow-red' },
    chartFill: '#ef4444',
    pill: 'bg-red-500/10 border-red-500/20 text-red-300',
    chip: 'bg-red-500/15 border-red-500/30 text-red-300',
  },
};

// Shared thresholds for classifying barometric pressure rate-of-change.
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

export interface EventSeverityInput {
  maxRate: number;          // max abs 1h rate within event (hPa/hour)
  swing: number;            // pressure swing within event (hPa)
  durationHours: number;    // event duration in hours
  lowBelowBaseline: number; // how far min pressure is below baseline (hPa)
}

export interface EventSeverityResult {
  score: number;        // 0–100 composite index
  severity: EnvSeverity;
}

export function computeEventSeverity(input: EventSeverityInput): EventSeverityResult {
  const { maxRate, swing, durationHours, lowBelowBaseline } = input;

  // Normalize components into [0, 1] using reasonable caps.
  const r1_n = Math.min(Math.abs(maxRate) / 2.0, 1);        // cap at 2.0 hPa/hour
  const swing_n = Math.min(Math.abs(swing) / 12.0, 1);      // cap at 12 hPa swing
  const duration_n = Math.min(Math.max(durationHours, 0) / 24.0, 1); // cap at 24 hours
  const low_n = Math.min(Math.max(lowBelowBaseline, 0) / 15.0, 1);   // cap at 15 hPa below baseline

  // Global weights (must sum to 1).
  const w_r = 0.4;
  const w_s = 0.3;
  const w_d = 0.2;
  const w_l = 0.1;

  const E_raw = w_r * r1_n + w_s * swing_n + w_d * duration_n + w_l * low_n;
  const score = Math.round(E_raw * 100);

  let severity: EnvSeverity = 'low';
  if (score >= 75) severity = 'severe';
  else if (score >= 50) severity = 'high';
  else if (score >= 25) severity = 'moderate';

  return { score, severity };
}

