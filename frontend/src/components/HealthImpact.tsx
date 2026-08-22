import { useState, useEffect, useRef, useMemo } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { createPortal } from "react-dom";
import { fetchSymptomLogs } from "../services/api";
import type { CurrentWeather, SymptomLogEntry } from "../services/api";
import type { HealthRisk, RiskLevel, HealthToggles } from "../types/health";
import { SEVERITY_THEME } from "../utils/severity";
import {
  getMigraineRisk,
  getClusterHeadacheRisk,
  getPOTSRisk,
  getMECFSRisk,
  getJointPainRisk,
  getFibromyalgiaRisk,
  getEDSRisk,
  getRaynaudsRisk,
  getSinusRisk,
  getSleepRisk,
  getAQIRisk,
  getGeomagneticRisk,
  getPollenRisk,
} from "../utils/healthLogic";

interface Props {
  data: CurrentWeather | null;
  loading: boolean;
  error: string | null;
  healthToggles: HealthToggles;
}

function RiskCard({
  risk,
  onClick,
  personalizedInfo,
}: {
  risk: HealthRisk;
  onClick: () => void;
  personalizedInfo?: {
    frequency: number;
    avgSeverity: number;
    topTriggers: string[];
    matchesPattern?: string;
  };
}) {
  const theme = {
    low: {
      card: "bg-gray-800/30 hover:bg-gray-800/50 border-gray-700/40 hover:border-emerald-500/30",
      stripe: "bg-emerald-500/50",
      title: "text-gray-300",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      desc: "text-gray-300",
      trigger: "text-gray-400",
      detail: "text-emerald-300",
      glow: "hover:shadow-glow-emerald",
    },
    moderate: {
      card: "bg-gray-800/30 hover:bg-amber-950/20 border-amber-500/25 hover:border-amber-500/45",
      stripe: "bg-amber-500",
      title: "text-gray-200",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/35",
      desc: "text-gray-300",
      trigger: "text-gray-400",
      detail: "text-amber-300",
      glow: "hover:shadow-glow-amber",
    },
    high: {
      card: "bg-gray-800/30 hover:bg-orange-950/25 border-orange-500/35 hover:border-orange-500/55",
      stripe: "bg-orange-500",
      title: "text-gray-100",
      badge: "bg-orange-500/20 text-orange-300 border-orange-500/40",
      desc: "text-gray-300",
      trigger: "text-gray-400",
      detail: "text-orange-300",
      glow: "hover:shadow-glow-red",
    },
    severe: {
      card: "bg-gray-800/30 hover:bg-red-950/30 border-red-500/40 hover:border-red-500/65",
      stripe: "bg-red-500",
      title: "text-white",
      badge: "bg-red-500/25 text-red-300 border-red-500/40",
      desc: "text-gray-300",
      trigger: "text-gray-400",
      detail: "text-red-300",
      glow: "hover:shadow-glow-red",
    },
  }[risk.risk];

  // Dynamic state: as risk climbs, surface more -- a low card stays quiet, but a
  // high/severe card leads with the single most actionable recommendation instead
  // of making you open the modal to find out what to actually do about it.
  const topRecommendation =
    risk.risk === "high" || risk.risk === "severe"
      ? risk.recommendations[0]
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
                relative group cursor-pointer overflow-hidden rounded-xl border text-left
                transition-all duration-300 hover:-translate-y-0.5
                flex h-full ${theme.card} ${theme.glow}
            `}
    >
      {/* Left accent stripe -- pulses for severe to draw the eye without a modal */}
      <div
        className={`w-1 shrink-0 ${theme.stripe} transition-all duration-300 group-hover:w-1.5 ${risk.risk === "severe" ? "animate-pulse" : ""}`}
      />

      {/* Card content */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        {/* Title + Risk Level */}
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5 mb-2 min-w-0">
          <h3
            className={`font-bold text-[12px] sm:text-[11px] uppercase tracking-widest leading-tight flex-1 min-w-0 break-words ${theme.title}`}
          >
            {risk.condition}
          </h3>
          <span
            className={`text-[10px] sm:text-[9px] font-bold uppercase px-2.5 sm:px-2 py-1 sm:py-0.5 rounded border shrink-0 ${theme.badge}`}
          >
            {risk.risk}
          </span>
        </div>

        {/* Description */}
        <p
          className={`text-[11px] sm:text-[10px] leading-relaxed flex-1 ${theme.desc}`}
        >
          {risk.description}
        </p>

        {/* Dynamic state: top recommendation surfaces directly on high/severe cards */}
        {topRecommendation && (
          <div className="mt-2 pt-2 border-t border-gray-700/20 flex items-start gap-1.5">
            <span
              className={`text-[10px] leading-none mt-0.5 shrink-0 ${theme.detail}`}
            >
              →
            </span>
            <span
              className={`text-[10px] sm:text-[9px] leading-relaxed ${theme.detail}`}
            >
              {topRecommendation}
            </span>
          </div>
        )}

        {/* Personalized Info */}
        {personalizedInfo && (
          <div className="mt-2 pt-2 space-y-1.5 text-[10px] sm:text-[9px] border-t border-gray-700/20">
            {personalizedInfo.frequency > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Your pattern:</span>
                <span className={theme.detail}>
                  {personalizedInfo.frequency}x logged • Avg{" "}
                  {personalizedInfo.avgSeverity.toFixed(1)}/10
                </span>
              </div>
            )}
            {personalizedInfo.topTriggers.length > 0 && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-400 shrink-0">Active:</span>
                <span className={`${theme.detail} text-right`}>
                  {personalizedInfo.topTriggers.join(", ")}
                </span>
              </div>
            )}
            {personalizedInfo.matchesPattern && (
              <div className="flex items-center gap-1 px-2 sm:px-1.5 py-1 sm:py-0.5 bg-blue-500/10 rounded border border-blue-500/20">
                <span className="text-blue-300 text-[9px] sm:text-[8px]">
                  {personalizedInfo.matchesPattern}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 pt-2 border-t border-gray-700/20 flex items-center justify-between gap-2">
          <span
            className={`text-[11px] sm:text-[10px] font-mono uppercase tracking-tight max-w-[70%] break-words ${theme.trigger}`}
          >
            {risk.trigger}
          </span>
          <span
            className={`text-[11px] sm:text-[10px] font-medium opacity-0 group-hover:opacity-80 transition-all duration-300 ${theme.detail}`}
          >
            Details →
          </span>
        </div>
      </div>
    </button>
  );
}

function DetailModal({
  risk,
  onClose,
}: {
  risk: HealthRisk | null;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(!!risk, modalRef, { onEscape: onClose });

  if (!risk) return null;

  const theme = {
    low: {
      stripe: "bg-emerald-500",
      text: "text-emerald-300",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/35",
      dot: "bg-emerald-400",
      headerBg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
    },
    moderate: {
      stripe: "bg-amber-500",
      text: "text-amber-300",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/35",
      dot: "bg-amber-400",
      headerBg: "bg-amber-500/10",
      border: "border-amber-500/30",
    },
    high: {
      stripe: "bg-orange-500",
      text: "text-orange-300",
      badge: "bg-orange-500/20 text-orange-300 border-orange-500/35",
      dot: "bg-orange-400",
      headerBg: "bg-orange-500/10",
      border: "border-orange-500/30",
    },
    severe: {
      stripe: "bg-red-500",
      text: "text-red-300",
      badge: "bg-red-500/25 text-red-300 border-red-500/40",
      dot: "bg-red-400",
      headerBg: "bg-red-500/15",
      border: "border-red-500/35",
    },
  }[risk.risk];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${risk.condition} risk details`}
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex ${theme.headerBg}`}>
          <div className={`w-1.5 shrink-0 ${theme.stripe}`} />
          <div className="flex-1 p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {risk.condition}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${theme.badge}`}
                >
                  {risk.risk} risk
                </span>
                <span className="text-[10px] text-gray-400 font-mono uppercase">
                  Trigger: {risk.trigger}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center hover:bg-gray-800/50 rounded-lg"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Summary */}
          <p className="text-gray-200 text-sm leading-relaxed">
            {risk.description}
          </p>

          {/* Detailed Explanation */}
          <div className="border-t border-gray-700/30 pt-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">
              Why This Affects Symptoms
            </h3>
            <p className="text-gray-300 text-[13px] leading-relaxed">
              {risk.detailedExplanation}
            </p>
          </div>

          {/* Two-column: Factors + Recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-700/30 pt-4">
            {/* Current Factors */}
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2.5">
                Current Factors
              </h3>
              <ul className="space-y-2">
                {risk.currentFactors.map((factor, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-gray-300"
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${theme.dot} mt-1.5 shrink-0`}
                    />
                    <span className="text-[12px] leading-relaxed">
                      {factor}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2.5">
                Recommendations
              </h3>
              <ul className="space-y-2">
                {risk.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-gray-300"
                  >
                    <span
                      className={`text-[10px] leading-none mt-0.5 shrink-0 ${theme.text}`}
                    >
                      →
                    </span>
                    <span className="text-[12px] leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ConditionStats {
  frequency: number;
  avgSeverity: number;
}

type SymptomStatsMap = Record<string, ConditionStats>;

function calculateConditionStats(logs: SymptomLogEntry[]): SymptomStatsMap {
  const stats: SymptomStatsMap = {};

  logs.forEach((log) => {
    log.tags.forEach((condition) => {
      if (!stats[condition]) {
        stats[condition] = { frequency: 0, avgSeverity: 0 };
      }
      stats[condition].frequency += 1;
      stats[condition].avgSeverity += log.severity;
    });
  });

  // Calculate averages
  Object.keys(stats).forEach((condition) => {
    if (stats[condition].frequency > 0) {
      stats[condition].avgSeverity /= stats[condition].frequency;
    }
  });

  return stats;
}

function getPersonalizedRiskInfo(
  condition: string,
  data: CurrentWeather | null,
  conditionStats: SymptomStatsMap,
): {
  frequency: number;
  avgSeverity: number;
  topTriggers: string[];
  matchesPattern?: string;
} {
  if (!data) return { frequency: 0, avgSeverity: 0, topTriggers: [] };

  const kpIndex = data.geomagnetic?.kpIndex ?? 0;
  const humidity = data.humidity ?? 0;
  const pressure = data.pressure ?? 0;
  const aqi = data.aqi?.usAqi ?? 0;

  // Get historical stats for this condition
  const stats = conditionStats[condition] || { frequency: 0, avgSeverity: 0 };

  // Determine active triggers based on current conditions
  const activeTriggers: string[] = [];

  if (kpIndex > 4) activeTriggers.push("Space Weather");
  if (humidity > 90) activeTriggers.push("High Humidity");
  if (Math.abs(data.derivative?.delta1h ?? 0) > 0.5)
    activeTriggers.push("Pressure Drop");
  if (aqi > 45) activeTriggers.push("Air Quality");

  // Personalized patterns for specific conditions
  const patterns: Record<string, string> = {
    Migraines:
      kpIndex > 4 && humidity > 85 ? "This matches your May 16 pattern" : "",
    Sinus: humidity > 90 ? "High humidity is your sinus trigger" : "",
    "ME/CFS": kpIndex > 4 ? "Geomagnetic storms affect you strongly" : "",
    Fibromyalgia:
      kpIndex > 4 && Math.abs(data.derivative?.delta1h ?? 0) > 0.3
        ? "Multiple triggers converging"
        : "",
  };

  return {
    frequency: stats.frequency,
    avgSeverity: stats.avgSeverity,
    topTriggers: activeTriggers,
    matchesPattern: patterns[condition] || undefined,
  };
}

export default function HealthImpact({
  data,
  loading,
  error,
  healthToggles,
}: Props) {
  const [selectedRisk, setSelectedRisk] = useState<HealthRisk | null>(null);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
  // Distinct from "user hasn't logged anything yet" (symptomLogs === []) -- without
  // this, a failed fetch silently drops each RiskCard's "Your pattern" section as if
  // there were no history, rather than surfacing that the fetch didn't succeed.
  const [symptomLogsError, setSymptomLogsError] = useState(false);

  // Fetch symptom logs on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await fetchSymptomLogs(90); // Last 90 days for good baseline
        setSymptomLogs(logs);
        setSymptomLogsError(false);
      } catch (err) {
        console.error("Failed to fetch symptom logs:", err);
        setSymptomLogsError(true);
      }
    };
    loadLogs();
  }, []);

  // Calculate condition statistics from symptom logs
  const conditionStats = useMemo(() => {
    return calculateConditionStats(symptomLogs);
  }, [symptomLogs]);

  if (loading) {
    return (
      <div className="bg-[#131d2e] rounded-2xl p-6 border border-[#1e2d45] animate-pulse">
        <div className="h-5 bg-gray-700/50 rounded w-48 mb-4" />
        <div className="h-16 bg-gray-700/30 rounded-xl mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#131d2e] rounded-2xl p-4 sm:p-6 border border-[#1e2d45] shadow-xl">
        <h2 className="text-gray-400 text-xs font-medium tracking-wider uppercase mb-2">
          Health Impact Forecast
        </h2>
        <p className="text-[12px] text-gray-400">
          {error
            ? "Couldn't load current conditions, so today's health impact can't be calculated right now."
            : "Waiting for current conditions to calculate today's health impact."}
        </p>
      </div>
    );
  }

  const d = data.derivative;
  const delta1h = d?.delta1h ?? 0;
  const delta3h = d?.delta3h ?? 0;
  const delta6h = d?.delta6h ?? 0;

  const pollenMax = data.pollen
    ? Math.max(
        data.pollen.treeIndex,
        data.pollen.grassIndex,
        data.pollen.weedIndex,
        data.pollen.moldIndex,
      )
    : 0;
  // Use the worse of model vs. hyperlocal (same rule getAQIRisk and the
  // CurrentConditions badge use) -- otherwise these contributing factors miss
  // exactly the local smoke plume the hyperlocal sensor exists to catch.
  const currentAqi = data.aqi
    ? data.aqi.hyperlocal
      ? Math.max(data.aqi.usAqi, data.aqi.hyperlocal.usAqi)
      : data.aqi.usAqi
    : null;

  const risks: HealthRisk[] = [];
  if (healthToggles.migraine)
    risks.push(getMigraineRisk(delta1h, delta3h, delta6h, currentAqi));
  if (healthToggles.cluster)
    risks.push(getClusterHeadacheRisk(delta1h, delta3h, delta6h, data.uvIndex));
  if (healthToggles.sinus)
    risks.push(
      getSinusRisk(
        delta1h,
        data.humidity,
        data.temperature,
        pollenMax,
        currentAqi,
      ),
    );
  if (healthToggles.pots)
    risks.push(
      getPOTSRisk(delta1h, data.humidity, data.temperature, currentAqi),
    );
  if (healthToggles.mecfs)
    risks.push(getMECFSRisk(delta1h, delta3h, delta6h, currentAqi));
  if (healthToggles.joints)
    risks.push(
      getJointPainRisk(delta1h, data.humidity, data.temperature, currentAqi),
    );
  if (healthToggles.fibromyalgia)
    risks.push(
      getFibromyalgiaRisk(delta1h, data.humidity, data.temperature, currentAqi),
    );
  if (healthToggles.eds)
    risks.push(getEDSRisk(delta1h, data.humidity, data.temperature));
  if (healthToggles.raynauds)
    risks.push(
      getRaynaudsRisk(data.temperature, data.humidity, data.windSpeed),
    );
  if (healthToggles.sleep)
    risks.push(
      getSleepRisk(
        delta1h,
        delta3h,
        delta6h,
        data.temperature,
        data.humidity,
        data.geomagnetic?.kpIndex ?? null,
        data.aqi?.usAqi ?? null,
      ),
    );
  if (healthToggles.aqi) risks.push(getAQIRisk(data.aqi ?? null));
  if (healthToggles.geomagnetic)
    risks.push(getGeomagneticRisk(data.geomagnetic ?? null));
  if (healthToggles.pollen) risks.push(getPollenRisk(data.pollen ?? null));

  if (risks.length === 0) {
    return (
      <div className="bg-[#131d2e] rounded-2xl p-4 sm:p-6 border border-[#1e2d45] shadow-xl">
        <h2 className="text-gray-400 text-xs font-medium tracking-wider uppercase mb-2">
          Health Impact Forecast
        </h2>
        <p className="text-[12px] text-gray-400">
          All health factors are currently disabled in settings. Turn some on to
          see weather-related impact.
        </p>
      </div>
    );
  }

  // Sort by severity: severe > high > moderate > low
  const riskOrder: Record<RiskLevel, number> = {
    severe: 3,
    high: 2,
    moderate: 1,
    low: 0,
  };
  const sortedRisks = [...risks].sort(
    (a, b) => riskOrder[b.risk] - riskOrder[a.risk],
  );
  const elevatedRisks = sortedRisks.filter((r) => r.risk !== "low");
  const highestRisk = sortedRisks[0];

  // Body Impact Summary config – use consistent level naming
  const summaryMap: Record<
    RiskLevel,
    {
      label: string;
      text: string;
      bar: string;
      gradient: string;
      chipBg: string;
      chipBorder: string;
      chipText: string;
    }
  > = {
    severe: {
      label: "Severe Impact",
      text: "text-red-400",
      bar: "bg-red-500",
      gradient: "from-red-500/8 via-transparent to-transparent",
      chipBg: "bg-red-500/15",
      chipBorder: "border-red-500/30",
      chipText: "text-red-300",
    },
    high: {
      label: "High Impact",
      text: "text-orange-400",
      bar: "bg-orange-500",
      gradient: "from-orange-500/8 via-transparent to-transparent",
      chipBg: "bg-orange-500/15",
      chipBorder: "border-orange-500/30",
      chipText: "text-orange-300",
    },
    moderate: {
      label: "Moderate Impact",
      text: "text-amber-400",
      bar: "bg-amber-500",
      gradient: "from-amber-500/8 via-transparent to-transparent",
      chipBg: "bg-amber-500/15",
      chipBorder: "border-amber-500/30",
      chipText: "text-amber-300",
    },
    low: {
      label: "Low Impact",
      text: "text-emerald-400",
      bar: "bg-emerald-500",
      gradient: "from-emerald-500/8 via-transparent to-transparent",
      chipBg: "bg-emerald-500/15",
      chipBorder: "border-emerald-500/30",
      chipText: "text-emerald-300",
    },
  };
  const sc = summaryMap[highestRisk.risk];
  const severityIdx = riskOrder[highestRisk.risk]; // 0-3
  const elevatedCount = elevatedRisks.length;
  const highestRiskLabel = `${highestRisk.condition} (${highestRisk.risk.charAt(0).toUpperCase() + highestRisk.risk.slice(1)})`;

  return (
    <div className="bg-[#131d2e] rounded-2xl p-4 sm:p-6 border border-[#1e2d45] shadow-xl">
      <h2 className="text-gray-400 text-xs font-medium tracking-wider uppercase mb-4">
        Health Impact Forecast
      </h2>

      {/* Body Impact Summary — Meter Bar Design */}
      <div className="relative overflow-hidden rounded-xl border border-gray-700/30 mb-6">
        <div
          className={`absolute inset-0 bg-gradient-to-r ${sc.gradient} pointer-events-none`}
        />

        <div className="relative p-5">
          {/* Header + Label */}
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Body Impact Level
              </span>
              <span className="text-[11px] sm:text-[10px] text-gray-400 mt-1 sm:mt-0.5">
                Based on current conditions and short-term forecast
              </span>
            </div>
            <span
              className={`text-lg sm:text-lg font-black tracking-tight ${sc.text}`}
            >
              {sc.label}
            </span>
          </div>

          {/* Severity Meter Bar */}
          <div className="flex gap-1 mb-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all duration-700 ${
                  i <= severityIdx ? sc.bar : "bg-gray-700/40"
                } ${i <= severityIdx ? "opacity-100" : "opacity-100"}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-gray-500 mb-3">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Severe</span>
          </div>

          {/* Summary text */}
          <p className="text-[12px] sm:text-[13px] text-gray-300/85 leading-relaxed">
            {elevatedCount === 0 ? (
              <>
                All environmental factors are within comfortable ranges. No
                weather-related symptom triggers detected.
              </>
            ) : (
              <>
                <span className="font-semibold">{sc.label} today.</span>{" "}
                <span className="font-semibold">Highest impact area:</span>{" "}
                <span>{highestRiskLabel}.</span>{" "}
                {elevatedCount > 1 ? (
                  <span className="font-medium text-gray-300/90">
                    {elevatedCount} conditions show some weather-related stress.
                  </span>
                ) : (
                  <span className="font-medium text-gray-300/90">
                    Other tracked conditions are currently low.
                  </span>
                )}
              </>
            )}
          </p>

          {/* Affected conditions chips */}
          {elevatedRisks.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {elevatedRisks.map((r, i) => (
                <span
                  key={i}
                  className={`text-[11px] sm:text-[10px] font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${SEVERITY_THEME[r.risk].chip}`}
                >
                  <span>{r.condition}</span>
                  <span className="opacity-40">·</span>
                  <span className="capitalize opacity-70">{r.risk}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Risk Cards — Horizontal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sortedRisks.map((risk, i) => (
          <RiskCard
            key={i}
            risk={risk}
            onClick={() => setSelectedRisk(risk)}
            personalizedInfo={
              // Omit rather than pass a zeroed-out object when the fetch failed --
              // showing "0x logged" would misrepresent a fetch failure as "you have
              // no history with this condition."
              symptomLogsError
                ? undefined
                : getPersonalizedRiskInfo(risk.condition, data, conditionStats)
            }
          />
        ))}
      </div>

      <DetailModal risk={selectedRisk} onClose={() => setSelectedRisk(null)} />
    </div>
  );
}
