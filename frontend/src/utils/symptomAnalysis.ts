import type { SymptomLogEntry, CurrentWeather } from "../services/api";

export interface ConditionTrigger {
  key: string;
  name: string;
  severity: number;
  pattern: string;
}

export interface ConditionAnalysis {
  name: string;
  count: number;
  avgSeverity: number;
  triggers: ConditionTrigger[];
  trendData: Array<{ date: string; severity: number }>;
}

export interface ProtectiveFactor {
  label: string;
  matchedAvgSeverity: number;
  count: number;
}

export type TodayRisk =
  | { status: "no-current-data" }
  | { status: "clear"; riskLevel: "low" }
  | {
      status: "active";
      primaryTrigger: ConditionTrigger;
      secondaryTrigger: ConditionTrigger | null;
      riskLevel: "low" | "moderate" | "high" | "severe";
    };

interface TriggerFactorDef {
  key: string;
  name: string;
  matchesLog: (log: SymptomLogEntry) => boolean;
  matchesCurrent: (current: CurrentWeather) => boolean;
  pattern: (matchedCount: number, totalCount: number) => string;
}

// Each trigger factor pairs a historical-log predicate with a live-conditions
// predicate over the same underlying signal, so computeTodayRisk can ask "is the
// trigger this condition is historically sensitive to actually happening right
// now" instead of just repeating a historical average forever.
const TRIGGER_FACTORS: TriggerFactorDef[] = [
  {
    key: "humidity",
    name: "High Humidity (> 85%)",
    matchesLog: (log) => (log.environmentalSnapshot?.humidity ?? 0) > 85,
    matchesCurrent: (current) => current.humidity > 85,
    pattern: (matched, total) =>
      `${matched} of ${total} entries with high humidity`,
  },
  {
    key: "geomagnetic",
    name: "Geomagnetic Activity (Kp > 4)",
    matchesLog: (log) =>
      (log.environmentalSnapshot?.geomagnetic?.kpIndex ?? 0) > 4,
    matchesCurrent: (current) => (current.geomagnetic?.kpIndex ?? 0) > 4,
    pattern: () => `Occurs when Kp index elevated`,
  },
  {
    key: "pressure",
    // A log with no environmental snapshot must not count as "low pressure" --
    // unlike the other factors here, a missing value defaulted to 0 would satisfy
    // a "< 990" comparison (fails open), so this checks for a real reading instead.
    name: "Low Pressure (< 990 hPa)",
    matchesLog: (log) => {
      const pressure = log.environmentalSnapshot?.pressure;
      return pressure != null && pressure < 990;
    },
    matchesCurrent: (current) => current.pressure < 990,
    pattern: (matched) => `${matched} entries with low pressure`,
  },
  {
    key: "aqi",
    name: "Poor Air Quality (AQI > 45)",
    matchesLog: (log) => (log.environmentalSnapshot?.aqi?.usAqi ?? 0) > 45,
    matchesCurrent: (current) => (current.aqi?.usAqi ?? 0) > 45,
    pattern: () => `Correlates with air quality spikes`,
  },
];

export function analyzeConditions(
  logs: SymptomLogEntry[],
): ConditionAnalysis[] {
  const conditions: Record<string, SymptomLogEntry[]> = {};
  logs.forEach((log) => {
    log.tags.forEach((tag) => {
      if (!conditions[tag]) conditions[tag] = [];
      conditions[tag].push(log);
    });
  });

  return Object.entries(conditions)
    .map(([name, condLogs]) => {
      const avgSeverity =
        condLogs.reduce((sum, l) => sum + l.severity, 0) / condLogs.length;

      const triggers: ConditionTrigger[] = TRIGGER_FACTORS.map((factor) => {
        const matched = condLogs.filter(factor.matchesLog);
        if (matched.length === 0) return null;
        return {
          key: factor.key,
          name: factor.name,
          severity:
            matched.reduce((sum, l) => sum + l.severity, 0) / matched.length,
          pattern: factor.pattern(matched.length, condLogs.length),
        };
      })
        .filter((t): t is ConditionTrigger => t !== null)
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 3);

      const sortedLogs = [...condLogs].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const trendData = sortedLogs.map((log) => ({
        date: new Date(log.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        severity: log.severity,
      }));

      return { name, count: condLogs.length, avgSeverity, triggers, trendData };
    })
    .sort((a, b) => b.count - a.count);
}

export function computeTodayRisk(
  topCondition: ConditionAnalysis | undefined,
  current: CurrentWeather | null,
): TodayRisk | null {
  if (!topCondition) return null;
  if (!current) return { status: "no-current-data" };

  const activeTriggers = topCondition.triggers.filter((t) => {
    const factor = TRIGGER_FACTORS.find((f) => f.key === t.key);
    return factor ? factor.matchesCurrent(current) : false;
  });

  const primaryTrigger = activeTriggers[0];
  if (!primaryTrigger) return { status: "clear", riskLevel: "low" };

  const secondaryTrigger = activeTriggers[1] ?? null;

  let riskLevel: "low" | "moderate" | "high" | "severe" = "low";
  const severity = primaryTrigger.severity;
  if (severity >= 7) riskLevel = "severe";
  else if (severity >= 5) riskLevel = "high";
  else if (severity > 3.5) riskLevel = "moderate";

  return { status: "active", primaryTrigger, secondaryTrigger, riskLevel };
}

interface ProtectiveFactorDef {
  label: string;
  hasData: (log: SymptomLogEntry) => boolean;
  matches: (log: SymptomLogEntry) => boolean;
}

const PROTECTIVE_FACTORS: ProtectiveFactorDef[] = [
  {
    label: "Rising pressure conditions correlate with milder symptoms",
    hasData: (log) => log.environmentalSnapshot?.derivative?.trend != null,
    matches: (log) => log.environmentalSnapshot?.derivative?.trend === "rising",
  },
  {
    label:
      "Moderate geomagnetic activity (Kp 2-3) tends to mean lower severity",
    hasData: (log) => log.environmentalSnapshot?.geomagnetic?.kpIndex != null,
    matches: (log) => {
      const kp = log.environmentalSnapshot?.geomagnetic?.kpIndex;
      return kp != null && kp >= 2 && kp <= 3;
    },
  },
  {
    label: "Good air quality (AQI ≤ 50) days show better symptom control",
    hasData: (log) => log.environmentalSnapshot?.aqi?.usAqi != null,
    matches: (log) => (log.environmentalSnapshot?.aqi?.usAqi ?? Infinity) <= 50,
  },
];

const MIN_SAMPLE = 2;
const MIN_SEVERITY_GAP = 1;

// Only surfaces a factor when the logged data actually supports it (a real
// severity gap between logs that had the factor and logs that didn't, each with
// enough of a sample to not be noise) -- replaces a fixed, always-shown claim
// list with ones the user's own data backs up.
export function computeProtectiveFactors(
  logs: SymptomLogEntry[],
): ProtectiveFactor[] {
  return PROTECTIVE_FACTORS.map((factor) => {
    const withData = logs.filter(factor.hasData);
    const matched = withData.filter(factor.matches);
    const unmatched = withData.filter((l) => !factor.matches(l));
    if (matched.length < MIN_SAMPLE || unmatched.length < MIN_SAMPLE)
      return null;

    const matchedAvg =
      matched.reduce((s, l) => s + l.severity, 0) / matched.length;
    const unmatchedAvg =
      unmatched.reduce((s, l) => s + l.severity, 0) / unmatched.length;
    const gap = unmatchedAvg - matchedAvg;
    if (gap < MIN_SEVERITY_GAP) return null;

    return {
      label: factor.label,
      matchedAvgSeverity: matchedAvg,
      count: matched.length,
      gap,
    };
  })
    .filter((f): f is ProtectiveFactor & { gap: number } => f !== null)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map(({ label, matchedAvgSeverity, count }) => ({
      label,
      matchedAvgSeverity,
      count,
    }));
}
