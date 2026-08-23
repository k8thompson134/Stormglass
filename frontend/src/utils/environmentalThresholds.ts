// Single source of truth for the environmental-condition thresholds used to
// flag a symptom trigger as "active" across the app -- previously hand-copied
// with drifted values in 3 places: symptomAnalysis.ts (humidity > 85),
// HealthImpact.tsx (humidity > 90 in one spot, > 85 in another -- neither
// matching), and Insights.tsx's "Dangerous Combinations" banner (re-implemented
// the same humidity/aqi/kp checks inline instead of importing them). All three
// now import from here, so a future threshold change can't silently apply to
// only some of them.
//
// LOW_PRESSURE_THRESHOLD is deliberately NOT shared with HealthImpact.tsx's
// "Pressure Drop" trigger -- that one checks delta1h (rate of change, hPa/hour),
// a different physical quantity from this absolute-reading threshold, so
// unifying them would conflate two genuinely different signals.
export const HIGH_HUMIDITY_THRESHOLD = 85;
export const LOW_PRESSURE_THRESHOLD = 990;
export const HIGH_KP_THRESHOLD = 4;
export const POOR_AQI_THRESHOLD = 45;
