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
  subText: string; // dimmer variant of `text`, for detail/subtitle lines under a headline
  bg: string;
  border: string;
  dot: string; // hex, for chart fills/reference lines
}> = {
  'Good': { shortLabel: 'Good', text: 'text-emerald-300', subText: 'text-emerald-300/70', bg: 'bg-emerald-500/20', border: 'border-emerald-500/35', dot: '#34d399' },
  'Moderate': { shortLabel: 'Moderate', text: 'text-yellow-300', subText: 'text-yellow-300/70', bg: 'bg-yellow-500/20', border: 'border-yellow-500/35', dot: '#eab308' },
  'Unhealthy for Sensitive Groups': { shortLabel: 'Sensitive', text: 'text-orange-300', subText: 'text-orange-300/70', bg: 'bg-orange-500/20', border: 'border-orange-500/35', dot: '#f97316' },
  'Unhealthy': { shortLabel: 'Unhealthy', text: 'text-red-300', subText: 'text-red-300/70', bg: 'bg-red-500/20', border: 'border-red-500/35', dot: '#ef4444' },
  'Very Unhealthy': { shortLabel: 'V. Unhealthy', text: 'text-purple-300', subText: 'text-purple-300/70', bg: 'bg-purple-500/20', border: 'border-purple-500/35', dot: '#a855f7' },
  'Hazardous': { shortLabel: 'Hazardous', text: 'text-rose-200', subText: 'text-rose-200/70', bg: 'bg-[#7e0023]/30', border: 'border-[#7e0023]/60', dot: '#7e0023' },
};

// Short, category-specific action rather than a generic "close your windows" for
// every severity. Same underlying wording as backend/src/services/push.ts's
// CATEGORY_GUIDANCE, capitalized and punctuated as a standalone sentence here since
// this renders as its own paragraph (the backend's version stays lowercase/no-period
// since it's embedded inline after "--" in a push notification body). The WORDING
// must stay in sync even though the formatting intentionally doesn't --
// backend/src/services/push.test.ts asserts this by normalizing both and comparing.
export const CATEGORY_GUIDANCE: Partial<Record<AqiCategory, string>> = {
  'Unhealthy for Sensitive Groups': "If you're sensitive to air quality, limit prolonged outdoor exertion.",
  'Unhealthy': 'Limit prolonged outdoor exertion.',
  'Very Unhealthy': 'Avoid outdoor exertion.',
  'Hazardous': 'Stay indoors and avoid outdoor exertion entirely.',
};

// A stricter type than AqiCategory -- only the 3 categories a person can actually
// choose as their "safe" ceiling (never Unhealthy/Very Unhealthy/Hazardous).
export type AqiSensitivity = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups';

// The 3 sensible "safe up to" presets a person picks ONCE (onboarding/Settings), not
// something flipped through per-visit -- Very Unhealthy/Hazardous aren't offered here
// since nobody wants to call those "safe." Single source of truth for onboarding,
// Settings, the one-time announcement, and the chart's passive read-only display.
export interface AqiSensitivityOption {
  label: string;
  category: AqiSensitivity;
  ceiling: number;
}

export const AQI_SENSITIVITY_OPTIONS: AqiSensitivityOption[] = [
  { label: 'Good only', category: 'Good', ceiling: 50 },
  { label: 'Moderate', category: 'Moderate', ceiling: 100 },
  { label: 'Sensitive-OK', category: 'Unhealthy for Sensitive Groups', ceiling: 150 },
];

export const DEFAULT_AQI_SENSITIVITY: AqiSensitivity = 'Moderate';

const AQI_SENSITIVITY_STORAGE_KEY = 'stormglass_aqi_sensitivity';

function isValidSensitivity(value: string | null): value is AqiSensitivity {
  return AQI_SENSITIVITY_OPTIONS.some(opt => opt.category === value);
}

export function getStoredAqiSensitivity(): AqiSensitivity | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(AQI_SENSITIVITY_STORAGE_KEY);
  return isValidSensitivity(stored) ? stored : null;
}

export function setStoredAqiSensitivity(value: AqiSensitivity): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AQI_SENSITIVITY_STORAGE_KEY, value);
}
