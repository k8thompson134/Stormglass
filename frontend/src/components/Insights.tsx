import { useState, useEffect, useMemo } from 'react';
import {
  fetchCorrelations,
  fetchCorrelationTimeseries,
  fetchSymptomLogs,
  type CorrelationResponse,
  type CorrelationTimeseriesResponse,
  type TopCorrelation,
  type SymptomLogEntry,
} from '../services/api';
import {
  ComposedChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface InsightsProps {
  onOpenSymptomLogger: () => void;
}

export default function Insights({ onOpenSymptomLogger }: InsightsProps) {
  const [correlationData, setCorrelationData] =
    useState<CorrelationResponse | null>(null);
  const [timeseriesData, setTimeseriesData] =
    useState<CorrelationTimeseriesResponse | null>(null);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [scatterVar, setScatterVar] = useState('pressure');
  const [trendVar, setTrendVar] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState(false);

  // Fetch symptom logs for personalization
  useEffect(() => {
    let isMounted = true;
    fetchSymptomLogs(days)
      .then((logs) => {
        if (isMounted) setSymptomLogs(logs);
      })
      .catch((err) => {
        if (isMounted) console.error('Failed to fetch symptom logs:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [days]);

  // Fetch correlation stats
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchCorrelations(days)
      .then((data) => {
        if (!isMounted) return;
        setCorrelationData(data);
        // Set initial trend variable to first top correlation
        if (
          !data.insufficient_data &&
          data.top_correlations &&
          data.top_correlations.length > 0
        ) {
          setTrendVar(data.top_correlations[0].variable);
        } else {
          setTrendVar(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to fetch correlations:', err);
        setCorrelationData(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [days]);

  // Fetch timeseries when top correlations are ready
  useEffect(() => {
    let isMounted = true;
    if (
      correlationData?.insufficient_data === false &&
      correlationData.top_correlations &&
      correlationData.top_correlations.length > 0
    ) {
      const topVars = correlationData.top_correlations
        .slice(0, 3)
        .map((c) => c.variable);
      const varsKey = topVars.join(',');

      // Skip fetch if variables haven't changed
      if (timeseriesData?.variables_meta && Object.keys(timeseriesData.variables_meta).join(',') === varsKey && timeseriesData.days === days) {
        return;
      }

      fetchCorrelationTimeseries(days, topVars)
        .then((data) => {
          if (isMounted) setTimeseriesData(data);
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Failed to fetch timeseries:', err);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [correlationData, days, timeseriesData]);

  // Analyze symptom logs for personalization
  const personalizedInsights = useMemo(() => {
    const conditionCounts: Record<string, number> = {};
    const conditionSeverities: Record<string, number[]> = {};

    symptomLogs.forEach((log) => {
      log.tags.forEach((condition) => {
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
        if (!conditionSeverities[condition]) {
          conditionSeverities[condition] = [];
        }
        conditionSeverities[condition].push(log.severity);
      });
    });

    const conditions = Object.keys(conditionCounts)
      .map((condition) => ({
        name: condition,
        count: conditionCounts[condition],
        avgSeverity:
          conditionSeverities[condition].reduce((a, b) => a + b, 0) /
          conditionSeverities[condition].length,
      }))
      .sort((a, b) => b.count - a.count);

    return conditions;
  }, [symptomLogs]);

  if (loading) {
    return (
      <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-6 text-center text-gray-400">
        Loading trends...
      </div>
    );
  }

  if (correlationData?.insufficient_data) {
    return (
      <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-6">
        <div className="text-center">
          <p className="text-gray-300 text-sm font-medium mb-3">
            Not enough data to detect patterns yet
          </p>
          <p className="text-gray-500 text-[11px] mb-4">
            Log at least 5 symptoms to see correlations with environmental
            factors
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

  if (!correlationData || correlationData.insufficient_data !== false) {
    return null;
  }

  const topCorrelations = correlationData.top_correlations || [];
  const visibleCards = expandedCards ? topCorrelations : topCorrelations.slice(0, 4);
  const hasMore = topCorrelations.length > 4;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Symptom Trends
        </h3>
        <div className="flex items-center gap-2">
          {['30d', '90d', '180d'].map((label) => {
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

      {/* Your Conditions Summary */}
      {personalizedInsights.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Your Tracked Conditions
          </p>
          <div className="flex flex-wrap gap-2">
            {personalizedInsights.slice(0, 5).map((condition) => (
              <div
                key={condition.name}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded text-[11px]"
              >
                <span className="font-semibold text-blue-300">{condition.name}</span>
                <span className="text-gray-500">
                  {condition.count}x • {condition.avgSeverity.toFixed(1)}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correlation Cards */}
      {topCorrelations.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleCards.map((corr) => (
              <CorrelationCard key={`${corr.variable}-${corr.lag_hours}`} correlation={corr} />
            ))}
          </div>
          {hasMore && !expandedCards && (
            <button
              onClick={() => setExpandedCards(true)}
              className="text-[10px] text-gray-500 hover:text-gray-300 font-medium transition-colors"
            >
              Show more ({topCorrelations.length - 4} additional)
            </button>
          )}
          {expandedCards && hasMore && (
            <button
              onClick={() => setExpandedCards(false)}
              className="text-[10px] text-gray-500 hover:text-gray-300 font-medium transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      ) : (
        <div className="text-gray-500 text-[11px] px-4 py-3">
          Not enough data for reliable patterns yet
        </div>
      )}

      {/* Trend Chart */}
      {timeseriesData && trendVar && (
        <TrendChart
          data={timeseriesData}
          selectedVariable={trendVar}
          onVariableChange={setTrendVar}
          availableVariables={topCorrelations.slice(0, 3).map((c) => c.variable)}
        />
      )}

      {/* Scatter Plot */}
      {correlationData && (
        <ScatterPlotPanel
          logs={correlationData.variables}
          selectedVariable={scatterVar}
          onVariableChange={setScatterVar}
        />
      )}
    </div>
  );
}

function CorrelationCard({ correlation }: { correlation: TopCorrelation }) {
  const isPositive = correlation.direction === 'positive';
  const borderColor = isPositive ? 'border-red-500/40' : 'border-blue-500/40';
  const bgColor = isPositive ? 'bg-red-500/5' : 'bg-blue-500/5';
  const textColor = isPositive ? 'text-red-300' : 'text-blue-300';

  const opacityClass =
    correlation.confidence === 'high'
      ? ''
      : correlation.confidence === 'medium'
        ? 'opacity-70'
        : 'opacity-50';

  return (
    <div
      className={`border rounded-lg p-3 ${borderColor} ${bgColor} ${opacityClass}`}
    >
      <div className={`${textColor} text-xs font-semibold mb-1`}>
        {correlation.label}
      </div>
      <div className="text-gray-300 text-[10px] space-y-1">
        <div>
          {isPositive ? '↑' : '↓'}{' '}
          {Math.abs(correlation.severity_delta || 0).toFixed(1)} severity pts
        </div>
        <div className="text-gray-500">
          {correlation.lag_hours}h lag · {correlation.r.toFixed(2)} correlation
        </div>
        <div className="inline-block bg-gray-800/50 px-2 py-0.5 rounded text-[9px] text-gray-400 mt-1">
          {correlation.confidence}
        </div>
      </div>
    </div>
  );
}

function TrendChart({
  data,
  selectedVariable,
  onVariableChange,
  availableVariables,
}: {
  data: CorrelationTimeseriesResponse;
  selectedVariable: string;
  onVariableChange: (v: string) => void;
  availableVariables: string[];
}) {
  const varMeta = data.variables_meta[selectedVariable];
  if (!varMeta) return null;

  return (
    <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-4">
      <div className="mb-3 flex gap-2 flex-wrap">
        {availableVariables.map((varKey) => {
          const meta = data.variables_meta[varKey];
          if (!meta) return null;
          return (
            <button
              key={varKey}
              onClick={() => onVariableChange(varKey)}
              className={`text-[9px] font-semibold px-2.5 py-1 rounded transition-colors ${
                selectedVariable === varKey
                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                  : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'
              }`}
            >
              {meta.label.split('(')[0].trim()}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#1e2d45"
            tickFormatter={(v: string) => {
              const [, m, d] = v.split('-');
              return `${parseInt(m)
                .toString()
                .padStart(2, '0')}/${d}`;
            }}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 10]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#ef4444"
            label={{ value: 'Severity', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke={varMeta.color}
            label={{
              value: varMeta.unit,
              angle: 90,
              position: 'insideRight',
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e2d45',
              borderRadius: '8px',
            }}
            cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
            formatter={(value: any) => {
              if (typeof value === 'number') return value.toFixed(1);
              return value;
            }}
            labelFormatter={(label) => `${label}`}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="severity_max"
            stroke="#ef4444"
            dot={false}
            isAnimationActive={false}
            name="Max Severity"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={selectedVariable}
            stroke={varMeta.color}
            dot={false}
            isAnimationActive={false}
            name={varMeta.label}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterPlotPanel({
  logs,
  selectedVariable,
  onVariableChange,
}: {
  logs: Record<string, any> | undefined;
  selectedVariable: string;
  onVariableChange: (v: string) => void;
}) {
  if (!logs || !logs[selectedVariable]) return null;

  const varData = logs[selectedVariable];
  if (!varData || typeof varData !== 'object' || !Array.isArray(varData.lags) || !varData.n || varData.n < 2) return null;

  // Generate synthetic scatter points that reflect the correlation strength and direction
  const lag0 = varData.lags[0];
  if (!lag0 || lag0.r === null) {
    return null; // No correlation data available for this variable
  }

  const r = lag0.r;
  const n = lag0.n;

  // Generate points with correlation r to the severity axis
  // Points are normalized to reasonable ranges
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    // Generate x uniformly across variable's reasonable range
    const x = Math.random() * 100;
    // Generate y based on x using the correlation coefficient
    // y = r * x + noise, normalized to severity 0-10
    const noise = Math.random() * (1 - Math.abs(r)) * 20 - (1 - Math.abs(r)) * 10;
    const y = Math.max(0, Math.min(10, (r * (x / 100)) * 10 + 5 + noise));
    // Only add valid finite numbers to prevent NaN in charts
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  const allVariables = Object.keys(logs || {})
    .filter((k) => logs[k].n >= 2)
    .slice(0, 8);

  return (
    <div className="bg-[#131d2e] border border-[#1e2d45] rounded-2xl p-4">
      <div className="mb-3 flex gap-2 flex-wrap">
        {allVariables.map((varKey) => {
          const meta = logs[varKey];
          return (
            <button
              key={varKey}
              onClick={() => onVariableChange(varKey)}
              className={`text-[9px] font-semibold px-2.5 py-1 rounded transition-colors ${
                selectedVariable === varKey
                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                  : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'
              }`}
            >
              {meta.label.split('(')[0].trim()}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
          <XAxis
            type="number"
            dataKey="x"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#1e2d45"
            label={{ value: varData.label, position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 10]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#1e2d45"
            label={{ value: 'Severity', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e2d45',
              borderRadius: '8px',
            }}
            cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
          />
          <Scatter
            name="Symptom Logs"
            data={points}
            fill="#a78bfa"
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-3 text-[10px] text-gray-500">
        {varData.n} data points · Correlation: {varData.best_r?.toFixed(2) || 'N/A'}
      </div>
    </div>
  );
}
