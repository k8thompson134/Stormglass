/** Severity level for a health risk (used for styling and ordering). */
export type RiskLevel = "low" | "moderate" | "high" | "severe";

/** A single health risk card: condition, level, trigger, copy, and recommendations.
 * `condition` is a display string from healthLogic.ts's own vocabulary -- it is
 * NOT guaranteed to match a symptom log's tag (which is a HealthConditionKey; see
 * CONDITION_LABELS below and HealthImpact.tsx's PersonalizedHealthRisk). Don't use
 * `condition` to look up anything keyed by symptom-log tags. */
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

/** Canonical display label for each condition key. Symptom logs persist the KEY (not
 * this label) as their tag -- see SymptomLogger.tsx -- so grouping/lookup by tag stays
 * exact-match everywhere, and this map is only for rendering a friendly name. */
export const CONDITION_LABELS: Record<HealthConditionKey, string> = {
  migraine: "Migraines",
  cluster: "Cluster Headache",
  pots: "POTS / Dysautonomia",
  mecfs: "ME/CFS",
  joints: "Joint Pain",
  fibromyalgia: "Fibromyalgia",
  eds: "EDS",
  raynauds: "Raynaud's",
  sinus: "Sinus",
  sleep: "Sleep Quality",
  aqi: "Air Quality",
  geomagnetic: "Geomagnetic",
  pollen: "Pollen",
};
