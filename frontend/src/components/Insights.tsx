import { useState, useEffect, useMemo } from "react";
import {
  fetchSymptomLogs,
  type SymptomLogEntry,
  type CurrentWeather,
} from "../services/api";
import {
  analyzeConditions,
  computeTodayRisk,
  computeProtectiveFactors,
  TRIGGER_FACTORS,
} from "../utils/symptomAnalysis";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface InsightsProps {
  onOpenSymptomLogger: () => void;
  current: CurrentWeather | null;
  // Set when the most recent weather-conditions fetch failed -- `current` still
  // holds the last successful snapshot in that case, so this is what distinguishes
  // "live and clear" from "we don't actually know right now, showing old data."
  currentFetchError?: string | null;
}

const RISK_THEME = {
  low: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    title: "text-emerald-300",
    badge: "text-emerald-300",
    bar: "bg-emerald-500",
  },
  moderate: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    title: "text-amber-300",
    badge: "text-amber-300",
    bar: "bg-amber-500",
  },
  high: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    title: "text-orange-300",
    badge: "text-orange-300",
    bar: "bg-orange-500",
  },
  severe: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    title: "text-red-300",
    badge: "text-red-300",
    bar: "bg-red-500",
  },
};

export default function Insights({
  onOpenSymptomLogger,
  current,
  currentFetchError,
}: InsightsProps) {
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [days, setDays] = useState(90);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(false);
    fetchSymptomLogs(days)
      .then((logs) => {
        if (isMounted) {
          setSymptomLogs(logs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to fetch symptom logs:", err);
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [days]);

  const conditionAnalysis = useMemo(
    () => analyzeConditions(symptomLogs),
    [symptomLogs],
  );

  const todayRisk = useMemo(
    () => computeTodayRisk(conditionAnalysis[0], current, !!currentFetchError),
    [conditionAnalysis, current, currentFetchError],
  );

  const protectiveFactors = useMemo(
    () => computeProtectiveFactors(symptomLogs),
    [symptomLogs],
  );

  if (loading) {
    return (
      <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-6 text-center text-gray-400">
        Loading your symptom analysis...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-6 text-center">
        <p className="text-gray-300 text-sm font-medium">
          Couldn't load your symptom history
        </p>
        <p className="text-gray-500 text-[11px] mt-1">
          Check your connection and try reopening this panel.
        </p>
      </div>
    );
  }

  if (symptomLogs.length < 3) {
    return (
      <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-6">
        <div className="text-center">
          <p className="text-gray-300 text-sm font-medium mb-3">
            Not enough data to analyze patterns yet
          </p>
          <p className="text-gray-500 text-[11px] mb-4">
            Log at least 3 symptoms to see your personal triggers and patterns
          </p>
          <button
            onClick={onOpenSymptomLogger}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg text-blue-300 text-xs font-medium transition-colors"
          >
            <span>+</span>
            <span>Log Symptom</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Symptom Analysis
        </h3>
        <div className="flex items-center gap-2">
          {["30d", "90d"].map((label) => {
            const d = parseInt(label);
            return (
              <button
                key={label}
                onClick={() => setDays(d)}
                className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                  days === d
                    ? "bg-violet-500/30 text-violet-300 border border-violet-500/50"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's Risk */}
      {todayRisk?.status === "no-current-data" && (
        <div className="bg-gray-500/10 border border-gray-500/30 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Today's Symptom Risk
          </p>
          <p className="text-[11px] text-gray-400">
            Current conditions unavailable — can't assess today's risk right
            now.
          </p>
        </div>
      )}

      {todayRisk?.status === "stale" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-1">
            Today's Symptom Risk
          </p>
          <p className="text-[11px] text-gray-300">
            Couldn't refresh current conditions — showing risk based on the last
            known reading, which may be out of date.
          </p>
        </div>
      )}

      {todayRisk?.status === "clear" && (
        <div
          className={`${RISK_THEME.low.bg} border ${RISK_THEME.low.border} rounded-2xl p-4`}
        >
          <p
            className={`text-[10px] font-bold ${RISK_THEME.low.title} uppercase tracking-widest mb-1`}
          >
            Today's Symptom Risk
          </p>
          <p className="text-[11px] text-gray-300">
            None of your known trigger conditions are present right now.
          </p>
        </div>
      )}

      {todayRisk?.status === "active" && (
        <div
          className={`${RISK_THEME[todayRisk.riskLevel].bg} border ${RISK_THEME[todayRisk.riskLevel].border} rounded-2xl p-4 space-y-3`}
        >
          <p
            className={`text-[10px] font-bold ${RISK_THEME[todayRisk.riskLevel].title} uppercase tracking-widest`}
          >
            Today's Symptom Risk
          </p>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-300">
                  Primary Trigger: {todayRisk.primaryTrigger.name}
                </span>
                <span
                  className={`text-[10px] font-bold ${RISK_THEME[todayRisk.riskLevel].badge} uppercase`}
                >
                  {todayRisk.riskLevel}
                </span>
              </div>
              <div className="w-full bg-gray-900/50 rounded-full h-2">
                <div
                  className={`${RISK_THEME[todayRisk.riskLevel].bar} h-2 rounded-full`}
                  style={{
                    width: `${Math.min(todayRisk.primaryTrigger.severity * 20, 100)}%`,
                  }}
                />
              </div>
            </div>

            {todayRisk.secondaryTrigger && (
              <div className="text-[10px] text-gray-400">
                Secondary: {todayRisk.secondaryTrigger.name}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Condition-Specific Analysis */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Your Condition Triggers
        </p>

        {conditionAnalysis.map((condition) => (
          <div
            key={condition.name}
            className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-4 space-y-3"
          >
            {/* Condition header */}
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[12px] sm:text-[11px] text-gray-100">
                {condition.name}
              </h4>
              <span className="text-[10px] text-gray-500">
                {condition.count}x logged, avg{" "}
                {condition.avgSeverity.toFixed(1)}/10
              </span>
            </div>

            {/* Top triggers */}
            {condition.triggers.length > 0 && (
              <div className="space-y-2">
                {condition.triggers.slice(0, 3).map((trigger, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-2.5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] sm:text-[10px] font-semibold text-gray-200">
                        {idx + 1}. {trigger.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {trigger.severity.toFixed(1)}/10
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {trigger.pattern}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Mini trend chart */}
            {condition.trendData.length > 2 && (
              <div className="mt-3 pt-3 border-t border-gray-700/20">
                <p className="text-[9px] text-gray-500 mb-2">30-Day Trend</p>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={condition.trendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1e2d45"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 9 }}
                      stroke="#6b7280"
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e2d45",
                        borderRadius: "6px",
                        fontSize: "11px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="severity"
                      stroke="#8b5cf6"
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recovery Factors */}
      {protectiveFactors.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
            What Helps Your Symptoms
          </p>
          <ul className="space-y-1.5 text-[11px] sm:text-[10px] text-gray-300">
            {protectiveFactors.map((factor) => (
              <li key={factor.label} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">+</span>
                <span>
                  {factor.label} ({factor.count} of your logs, avg{" "}
                  {factor.matchedAvgSeverity.toFixed(1)}/10)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dangerous Combinations -- reuses the same humidity/aqi/geomagnetic
          predicates TRIGGER_FACTORS defines above, rather than re-hardcoding
          the thresholds here, so this can't silently drift from them. */}
      {symptomLogs.some((log) => {
        const humidity = TRIGGER_FACTORS.find(
          (f) => f.key === "humidity",
        )!.matchesLog(log);
        const aqi = TRIGGER_FACTORS.find((f) => f.key === "aqi")!.matchesLog(
          log,
        );
        const geomagnetic = TRIGGER_FACTORS.find(
          (f) => f.key === "geomagnetic",
        )!.matchesLog(log);
        return humidity && (aqi || geomagnetic);
      }) && (
        <div className="bg-orange-500/15 border border-orange-500/50 rounded-2xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/30">
                <div className="h-2 w-2 rounded-full bg-orange-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-orange-300 uppercase tracking-widest">
                Dangerous Combinations
              </p>
              <p className="text-[12px] sm:text-[11px] text-orange-200 mt-2 leading-relaxed">
                High humidity combined with air quality spikes or geomagnetic
                storms. These patterns correlate with your worst symptom days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data Summary */}
      <div className="text-[10px] text-gray-500 text-center pt-2">
        Analysis based on {symptomLogs.length} logged entries over {days} days
      </div>
    </div>
  );
}
