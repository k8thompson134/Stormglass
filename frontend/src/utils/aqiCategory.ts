// Single source of truth for the official EPA/AirNow US AQI category bands on the
// frontend -- mirrors backend/src/utils/aqiWindows.ts's classifyAqiCategory exactly
// (frontend/backend are separate builds, so this stays a deliberate, matching copy
// rather than a shared import). CurrentConditions, AQIForecastChart, AQISeasonSummary,
// and healthLogic.ts all call into this instead of hand-copying the boundaries.
export type AqiCategory = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';

export const CATEGORY_ORDER: AqiCategory[] = [
  'Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous',
];

export function classifyAqiCategory(usAqi: number): AqiCategory {
  if (usAqi >= 301) return 'Hazardous';
  if (usAqi >= 201) return 'Very Unhealthy';
  if (usAqi >= 151) return 'Unhealthy';
  if (usAqi >= 101) return 'Unhealthy for Sensitive Groups';
  if (usAqi >= 51) return 'Moderate';
  return 'Good';
}

// PurpleAir's dense sensor network catches localized smoke plumes that the
// ~11km-grid regional model can miss or lag; take the worse (higher) of the two
// readings, matching the backend's getAQIRisk, so the headline number/category shown
// in the UI always agrees with the severity used in the risk card.
export function effectiveAqi(modelAqi: number, hyperlocalAqi: number | null | undefined): number {
  return hyperlocalAqi != null ? Math.max(modelAqi, hyperlocalAqi) : modelAqi;
}

// Continuous 0-1 severity used to graduate AQI's influence on OTHER risk
// calculations (migraine, ME/CFS, POTS, joint pain, etc.) across all 6 EPA
// categories, rather than saturating at a single "unhealthy" cutoff -- a Hazardous
// day should weigh more heavily than a bare Unhealthy one, not identically.
// Coefficients here are a heuristic ladder, not derived from a specific study; keep
// escalation modest and monotonic rather than implying more precision than the
// evidence supports. Mirrors backend/src/utils/aqiWindows.ts's SEVERITY_FACTOR.
const SEVERITY_FACTOR: Record<AqiCategory, number> = {
  'Good': 0,
  'Moderate': 0.15,
  'Unhealthy for Sensitive Groups': 0.35,
  'Unhealthy': 0.6,
  'Very Unhealthy': 0.8,
  'Hazardous': 1,
};

export function aqiSeverityFactor(usAqi: number | null | undefined): number {
  if (usAqi == null) return 0;
  return SEVERITY_FACTOR[classifyAqiCategory(usAqi)];
}

// Graduated 0/1/2 contribution to an integer risk score (POTS, joint pain,
// fibromyalgia, sinus, sleep), escalating once air quality crosses into genuinely
// worse categories instead of a flat +1 for anything past a single "polluted"
// threshold.
export function aqiScoreBump(usAqi: number | null | undefined): 0 | 1 | 2 {
  if (usAqi == null) return 0;
  const category = classifyAqiCategory(usAqi);
  if (category === 'Very Unhealthy' || category === 'Hazardous') return 2;
  if (category === 'Unhealthy for Sensitive Groups' || category === 'Unhealthy') return 1;
  return 0;
}

// EPA/AirNow's official per-category colors (approximated in Tailwind's palette),
// plus a short label for compact badges/legends.
export const AQI_CATEGORY_THEME: Record<AqiCategory, {
  shortLabel: string;
  text: string;
  bg: string;
  border: string;
  dot: string; // hex, for chart fills/reference lines
}> = {
  'Good': { shortLabel: 'Good', text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/35', dot: '#34d399' },
  'Moderate': { shortLabel: 'Moderate', text: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/35', dot: '#eab308' },
  'Unhealthy for Sensitive Groups': { shortLabel: 'Sensitive', text: 'text-orange-300', bg: 'bg-orange-500/20', border: 'border-orange-500/35', dot: '#f97316' },
  'Unhealthy': { shortLabel: 'Unhealthy', text: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/35', dot: '#ef4444' },
  'Very Unhealthy': { shortLabel: 'V. Unhealthy', text: 'text-purple-300', bg: 'bg-purple-500/20', border: 'border-purple-500/35', dot: '#a855f7' },
  'Hazardous': { shortLabel: 'Hazardous', text: 'text-rose-200', bg: 'bg-[#7e0023]/30', border: 'border-[#7e0023]/60', dot: '#7e0023' },
};
