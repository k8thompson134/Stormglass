/** Severity level for a health risk (used for styling and ordering). */
export type RiskLevel = "low" | "moderate" | "high" | "severe";

/** A single health risk card: condition, level, trigger, copy, and recommendations. */
export interface HealthRisk {
  condition: string;
  risk: RiskLevel;
  trigger: string;
  description: string;
  icon: string;
  detailedExplanation: string;
  currentFactors: string[];
  recommendations: string[];
}

/** Ordered list of all health conditions. Used throughout the app to ensure consistent
 * UI ordering and avoid silent bugs from drifting copies. */
export const HEALTH_CONDITIONS = [
  "migraine",
  "cluster",
  "pots",
  "mecfs",
  "joints",
  "fibromyalgia",
  "eds",
  "raynauds",
  "sinus",
  "sleep",
  "aqi",
  "geomagnetic",
  "pollen",
] as const;

/** Keys used to control which health factors are shown in the dashboard. */
export type HealthConditionKey = (typeof HEALTH_CONDITIONS)[number];

/** Map of each health condition to whether it is enabled in the UI (persisted in localStorage). */
export type HealthToggles = Record<HealthConditionKey, boolean>;
