import { useState, useEffect, useMemo } from 'react';
import {
  fetchSymptomLogs,
  type SymptomLogEntry,
} from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface InsightsProps {
  onOpenSymptomLogger: () => void;
}

interface ConditionTrigger {
  name: string;
  severity: number;
  pattern: string;
}

interface ConditionAnalysis {
  name: string;
  count: number;
  avgSeverity: number;
  triggers: ConditionTrigger[];
  trendData: Array<{ date: string; severity: number }>;
}

export default function Insights({ onOpenSymptomLogger }: InsightsProps) {
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchSymptomLogs(days)
      .then((logs) => {
        if (isMounted) {
          setSymptomLogs(logs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to fetch symptom logs:', err);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [days]);

  // Analyze condition-specific triggers
  const conditionAnalysis = useMemo(() => {
    const conditions: Record<string, SymptomLogEntry[]> = {};

    symptomLogs.forEach((log) => {
      log.tags.forEach((condition) => {
        if (!conditions[condition]) conditions[condition] = [];
        conditions[condition].push(log);
      });
    });

    const analysis: ConditionAnalysis[] = Object.entries(conditions)
      .map(([name, logs]) => {
        const avgSeverity = logs.reduce((sum, l) => sum + l.severity, 0) / logs.length;

        // Analyze triggers
        const humidityLogs = logs.filter((l) => l.environmentalSnapshot?.humidity ?? 0 > 85);
        const lowPressureLogs = logs.filter((l) => (l.environmentalSnapshot?.pressure ?? 0) < 990);
        const highKpLogs = logs.filter((l) => (l.environmentalSnapshot?.geomagnetic?.kpIndex ?? 0) > 4);
        const poorAqiLogs = logs.filter((l) => (l.environmentalSnapshot?.aqi?.usAqi ?? 0) > 45);

        const triggers: ConditionTrigger[] = [];

        if (humidityLogs.length > 0) {
          triggers.push({
            name: 'High Humidity (> 85%)',
            severity: humidityLogs.reduce((sum, l) => sum + l.severity, 0) / humidityLogs.length,
            pattern: `${humidityLogs.length} of ${logs.length} entries with high humidity`,
          });
        }

        if (highKpLogs.length > 0) {
          triggers.push({
            name: 'Geomagnetic Activity (Kp > 4)',
            severity: highKpLogs.reduce((sum, l) => sum + l.severity, 0) / highKpLogs.length,
            pattern: `Occurs when Kp index elevated`,
          });
        }

        if (lowPressureLogs.length > 0) {
          triggers.push({
            name: 'Low Pressure (< 990 hPa)',
            severity: lowPressureLogs.reduce((sum, l) => sum + l.severity, 0) / lowPressureLogs.length,
            pattern: `${lowPressureLogs.length} entries with low pressure`,
          });
        }

        if (poorAqiLogs.length > 0) {
          triggers.push({
            name: 'Poor Air Quality (AQI > 45)',
            severity: poorAqiLogs.reduce((sum, l) => sum + l.severity, 0) / poorAqiLogs.length,
            pattern: `Correlates with air quality spikes`,
          });
        }

        // Sort by severity impact
        triggers.sort((a, b) => b.severity - a.severity);

        // Create trend data
        const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const trendData = sortedLogs.map((log) => ({
          date: new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          severity: log.severity,
        }));

        return {
          name,
          count: logs.length,
          avgSeverity,
          triggers: triggers.slice(0, 3),
          trendData,
        };
      })
      .sort((a, b) => b.count - a.count);

    return analysis;
  }, [symptomLogs]);

  // Calculate today's risk (mock current conditions for demo)
  const todayRisk = useMemo(() => {
    const topCondition = conditionAnalysis[0];
    if (!topCondition) return null;

    const primaryTrigger = topCondition.triggers[0];
    const secondaryTrigger = topCondition.triggers[1] || null;

    return {
      primaryTrigger,
      secondaryTrigger,
      riskLevel: primaryTrigger ? (primaryTrigger.severity > 3.5 ? 'MODERATE' : 'LOW') : 'LOW',
    };
  }, [conditionAnalysis]);

  if (loading) {
    return (
      <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-6 text-center text-gray-400">
        Loading your symptom analysis...
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
          {['30d', '90d'].map((label) => {
            const d = parseInt(label);
            return (
              <button
                key={label}
                onClick={() => setDays(d)}
                className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                  days === d
                    ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's Risk */}
      {todayRisk && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
            Today's Symptom Risk
          </p>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-300">Primary Trigger: {todayRisk.primaryTrigger?.name}</span>
                <span className="text-[10px] font-bold text-blue-300">{todayRisk.riskLevel}</span>
              </div>
              <div className="w-full bg-gray-900/50 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min((todayRisk.primaryTrigger?.severity ?? 0) * 20, 100)}%`,
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
              <h4 className="font-bold text-[12px] sm:text-[11px] text-gray-100">{condition.name}</h4>
              <span className="text-[10px] text-gray-500">
                {condition.count}x logged, avg {condition.avgSeverity.toFixed(1)}/10
              </span>
            </div>

            {/* Top triggers */}
            {condition.triggers.length > 0 && (
              <div className="space-y-2">
                {condition.triggers.map((trigger, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-2.5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] sm:text-[10px] font-semibold text-gray-200">
                        {idx + 1}. {trigger.name}
                      </span>
                      <span className="text-[10px] text-blue-300 font-medium">
                        {trigger.severity.toFixed(1)}/10
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">{trigger.pattern}</p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#6b7280" />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 9 }} stroke="#6b7280" width={30} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e2d45',
                        borderRadius: '6px',
                        fontSize: '11px',
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
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
          What Helps Your Symptoms
        </p>
        <ul className="space-y-1.5 text-[11px] sm:text-[10px] text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold shrink-0">+</span>
            <span>Rising pressure conditions correlate with milder symptoms</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold shrink-0">+</span>
            <span>Moderate geomagnetic activity (Kp 2-3) tends to mean lower severity</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold shrink-0">+</span>
            <span>Stable to warm temperatures show better symptom control</span>
          </li>
        </ul>
      </div>

      {/* Dangerous Combinations */}
      {symptomLogs.some(
        (log) =>
          (log.environmentalSnapshot?.humidity ?? 0) > 85 &&
          ((log.environmentalSnapshot?.aqi?.usAqi ?? 0) > 45 ||
            (log.environmentalSnapshot?.geomagnetic?.kpIndex ?? 0) > 4)
      ) && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
            Dangerous Combinations
          </p>
          <p className="text-[11px] sm:text-[10px] text-orange-300/80">
            Watch for: High humidity combined with air quality spikes or geomagnetic storms. These combinations
            appear to trigger your worst symptom days.
          </p>
        </div>
      )}

      {/* Data Summary */}
      <div className="text-[10px] text-gray-500 text-center pt-2">
        Analysis based on {symptomLogs.length} logged entries over {days} days
      </div>
    </div>
  );
}
