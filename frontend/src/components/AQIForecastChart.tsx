import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
} from 'recharts';
import { fetchAQIForecast, type AQIForecast, type AQIForecastPoint } from '../services/api';
import { SEVERITY_THEME, type EnvSeverity } from '../utils/severity';

const TIME_RANGES = [
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
  { label: '7d', value: 168 },
];

// Mirrors AQI_CONFIG's US AQI thresholds in healthRisks.ts -- kept in sync manually
// since this is presentation-layer bucketing, not the health-risk source of truth.
function classifyAqi(usAqi: number): EnvSeverity {
  if (usAqi >= 200) return 'severe';
  if (usAqi >= 150) return 'high';
  if (usAqi >= 100) return 'moderate';
  return 'low';
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric' });
  } catch { return ''; }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  } catch { return ''; }
}

function formatDayTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: 'numeric' });
    return isToday ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  } catch { return ''; }
}

function formatTooltipDate(label: string): string {
  try {
    const d = new Date(label);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

interface ChartPoint extends AQIForecastPoint {
  aqiChart?: number;
  forecastAqi?: number;
  pm25Chart?: number;
  forecastPm25?: number;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  payload: ChartPoint;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const severity = classifyAqi(point.usAqi);
  const isForecast = payload.some(e => e.dataKey === 'forecastAqi' && e.value != null)
    && !payload.some(e => e.dataKey === 'aqiChart' && e.value != null);

  return (
    <div className="bg-gray-950/95 border border-gray-700/50 rounded-lg p-3 text-xs shadow-2xl backdrop-blur-sm min-w-[170px]">
      <p className="text-gray-400 font-semibold mb-2 text-[11px] tracking-wide">
        {isForecast && <span className="text-cyan-400 mr-1.5">FORECAST</span>}
        {formatTooltipDate(label || '')}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-gray-400">US AQI</span>
          <span className="font-mono font-medium" style={{ color: SEVERITY_THEME[severity].chartFill }}>{point.usAqi}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-gray-400">PM2.5</span>
          <span className="text-white font-mono font-medium">{point.pm25.toFixed(1)} μg/m³</span>
        </div>
      </div>
    </div>
  );
}

function CategoryCrossingBanner({ forecast }: { forecast: AQIForecast }) {
  const crossing = forecast.categoryCrossing;
  if (!crossing) return null;

  const severity = classifyAqi(crossing.usAqi);
  const theme = severity === 'severe'
    ? { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-300', sub: 'text-red-300/70' }
    : { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-300', sub: 'text-orange-300/70' };

  return (
    <div className={`rounded-xl border ${theme.border} ${theme.bg} px-4 py-3 mb-4`}>
      <p className={`${theme.text} text-[13px] font-semibold`}>
        Heads up — crosses into {crossing.toCategory} around {formatDayTime(crossing.at)}
      </p>
      <p className={`${theme.sub} text-[11px] mt-0.5`}>
        Forecast AQI reaches {crossing.usAqi} then. Worth prepping (windows, filtration) before it arrives.
      </p>
    </div>
  );
}

function SafeWindowCallout({ forecast }: { forecast: AQIForecast }) {
  const { nextSafeWindow: next, threshold } = forecast;

  if (!next) {
    return (
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 mb-4">
        <p className="text-orange-300 text-[13px] font-semibold">AQI not expected below {threshold} in the next 72h</p>
        <p className="text-orange-300/70 text-[11px] mt-0.5">
          The forecast stays at or above AQI {threshold} for the full 3-day outlook.
        </p>
      </div>
    );
  }

  const startsNow = next.isCurrent;
  const durationLabel = next.durationHours >= 24
    ? `${(next.durationHours / 24).toFixed(1)}d`
    : `${Math.round(next.durationHours)}h`;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 mb-4">
      <p className="text-emerald-300 text-[13px] font-semibold">
        {startsNow
          ? <>Currently below AQI {threshold} — expected to hold through {formatDayTime(next.end)}</>
          : <>Next stretch below AQI {threshold}: {formatDayTime(next.start)} – {formatDayTime(next.end)}</>}
      </p>
      <p className="text-emerald-300/70 text-[11px] mt-0.5">
        {durationLabel} under AQI {threshold} · avg {next.avgAqi}
        {next.maxAqi > threshold && ` (brief spike to ${next.maxAqi} included)`}
      </p>
    </div>
  );
}

export default function AQIForecastChart() {
  const [forecast, setForecast] = useState<AQIForecast | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from "no data yet" (forecast: null via a clean 404) -- a real fetch
  // failure during an outage should say so rather than silently vanish, which is
  // the worst failure mode for a feature whose whole point is checking during an
  // active smoke event.
  const [error, setError] = useState(false);
  const [hours, setHours] = useState(6);
  const [showForecast, setShowForecast] = useState(true);
  const [showPm25, setShowPm25] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAQIForecast(hours)
      .then(result => { if (!cancelled) { setForecast(result); setError(false); } })
      .catch(() => { if (!cancelled) { setForecast(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hours]);

  // Validate + coerce raw series -- guards against a stray non-numeric row rather
  // than letting NaN silently break the chart's domain/scale calculations.
  const validData = useMemo(() => {
    if (!forecast) return [];
    return forecast.series
      .filter(d => d && d.timestamp && !isNaN(new Date(d.timestamp).getTime()))
      .map(d => ({ ...d, usAqi: Number(d.usAqi), pm25: Number(d.pm25) }))
      .filter(d => !isNaN(d.usAqi));
  }, [forecast]);

  const nowTs = useMemo(() => Date.now(), [validData]);

  // Split into past (solid) / forecast (dashed) segments, bridged so the lines
  // connect at "now" -- same technique as PressureChart's pressure/forecastPressure.
  const chartData: ChartPoint[] = useMemo(() => {
    const mapped = validData.map(d => {
      const ts = new Date(d.timestamp).getTime();
      const isForecast = ts > nowTs;
      return {
        ...d,
        aqiChart: isForecast ? undefined : d.usAqi,
        forecastAqi: isForecast ? d.usAqi : undefined,
        pm25Chart: isForecast ? undefined : d.pm25,
        forecastPm25: isForecast ? d.pm25 : undefined,
      };
    });
    for (let i = 0; i < mapped.length - 1; i++) {
      if (mapped[i].aqiChart !== undefined && mapped[i + 1].forecastAqi !== undefined) {
        mapped[i].forecastAqi = mapped[i].aqiChart;
        mapped[i].forecastPm25 = mapped[i].pm25Chart;
        break;
      }
    }
    // Unlike PressureChart, no "except at 6h" exemption is needed here: the backend
    // already scales the forecast portion of the series to match `hours` (a 6h view
    // only ever contains ~6h of forecast to begin with), so trimming applies
    // uniformly across all range selections.
    if (!showForecast) {
      return mapped.filter(d => new Date(d.timestamp).getTime() <= nowTs);
    }
    return mapped;
  }, [validData, nowTs, showForecast]);

  const nowPoint = useMemo(() => {
    if (!validData.length) return null;
    return validData.reduce((prev, curr) =>
      Math.abs(new Date(curr.timestamp).getTime() - nowTs) < Math.abs(new Date(prev.timestamp).getTime() - nowTs) ? curr : prev
    , validData[0]);
  }, [validData, nowTs]);

  const peak = useMemo(() => {
    if (!validData.length) return null;
    return validData.reduce((max, p) => p.usAqi > max.usAqi ? p : max, validData[0]);
  }, [validData]);

  const { minAqi, avgAqi, maxAqiVal } = useMemo(() => {
    if (validData.length === 0) return { minAqi: 0, avgAqi: 0, maxAqiVal: 0 };
    const vals = validData.map(d => d.usAqi);
    return {
      minAqi: Math.min(...vals),
      avgAqi: vals.reduce((a, b) => a + b, 0) / vals.length,
      maxAqiVal: Math.max(...vals),
    };
  }, [validData]);

  const maxPm25 = useMemo(() => validData.length ? Math.max(...validData.map(d => d.pm25)) : 0, [validData]);

  // safeWindows come from the backend's full 72h outlook (deliberately NOT scaled
  // down with `hours`, so the "clear through Thu" callout stays accurate even while
  // zoomed into a 6h chart) -- but a ReferenceArea's x1/x2 must match a timestamp
  // actually present in the rendered series, or Recharts can't place it. Always clamp
  // to whatever's actually visible right now (which shrinks/grows with both the
  // history range and the forecast toggle), not just when forecast is hidden.
  const visibleSafeWindows = useMemo(() => {
    if (!forecast || chartData.length === 0) return [];
    const firstMs = new Date(chartData[0].timestamp).getTime();
    const lastMs = new Date(chartData[chartData.length - 1].timestamp).getTime();
    return forecast.safeWindows
      .map(w => ({
        ...w,
        start: new Date(Math.max(new Date(w.start).getTime(), firstMs)).toISOString(),
        end: new Date(Math.min(new Date(w.end).getTime(), lastMs)).toISOString(),
      }))
      .filter(w => new Date(w.start).getTime() <= new Date(w.end).getTime());
  }, [forecast, chartData]);

  if (loading) {
    return <div className="bg-gray-800/20 rounded-2xl h-[420px] animate-pulse" />;
  }

  if (error) {
    return (
      <div className="bg-[#131d2e] rounded-2xl p-4 border border-red-500/20 text-[12px] text-red-300/80">
        Couldn't load the air quality forecast — the server may be unreachable. Try reloading.
      </div>
    );
  }

  if (!forecast || validData.length === 0) {
    return null; // no AQI data yet (clean 404) -- don't show an empty chart card
  }

  return (
    <figure className="bg-[#131d2e] rounded-2xl p-4 sm:p-6 border border-[#1e2d45] shadow-xl overflow-hidden">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <figcaption>
            <h2 className="text-gray-300 text-sm font-bold uppercase tracking-wider">
              Air Quality
            </h2>
          </figcaption>
          <div className="flex bg-gray-900/50 p-1 rounded-md shrink-0">
            {TIME_RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setHours(r.value)}
                aria-pressed={hours === r.value}
                className={`px-3 py-1 text-xs font-bold rounded ${hours === r.value ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-gray-500">Regional model — PurpleAir sensors (when available) may read higher during smoke</p>
      </div>

      <CategoryCrossingBanner forecast={forecast} />
      <SafeWindowCallout forecast={forecast} />

      {/* Data summary bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-[11px] font-mono text-gray-400">
        <span>{validData.length} readings</span>
        <span className="text-gray-500">|</span>
        <span>
          {formatDate(validData[0].timestamp)} {' → '} {formatTime(validData[validData.length - 1].timestamp)}
        </span>
        <span className="text-gray-500">|</span>
        <span>Peak: <span className={maxAqiVal > 100 ? 'text-amber-400' : 'text-emerald-400'}>{Math.round(peak?.usAqi ?? 0)}</span></span>
      </div>

      <div className="h-[260px] sm:h-[320px] w-full" role="img" aria-label={`Air quality chart. Current AQI ${nowPoint?.usAqi ?? '—'}, peak ${peak?.usAqi ?? '—'}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={hours <= 48 ? formatTime : formatDate}
              stroke="#4b5563"
              tick={{ fontSize: 11 }}
              minTickGap={hours <= 6 ? 15 : 40}
            />
            <YAxis
              yAxisId="left"
              domain={[0, Math.max(maxAqiVal + 20, 120)]}
              tickFormatter={(v: number) => Math.round(v).toString()}
              stroke="#4b5563"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <YAxis
              yAxisId="pm25"
              orientation="left"
              domain={[0, Math.max(maxPm25 * 1.3, 20)]}
              tickFormatter={(v: number) => Math.round(v).toString()}
              stroke="#22d3ee"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              hide={!showPm25}
              width={30}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Safe-window shading */}
            {visibleSafeWindows.map((w, i) => (
              <ReferenceArea
                key={`safe-${i}`}
                yAxisId="left"
                x1={w.start}
                x2={w.end}
                fill={SEVERITY_THEME.low.chartFill}
                fillOpacity={0.06}
                strokeOpacity={0}
              />
            ))}

            {/* AQI category reference lines */}
            <ReferenceLine yAxisId="left" y={100} stroke={SEVERITY_THEME.moderate.chartFill} strokeDasharray="3 3" opacity={0.4} />
            <ReferenceLine yAxisId="left" y={150} stroke={SEVERITY_THEME.high.chartFill} strokeDasharray="3 3" opacity={0.4} />
            <ReferenceLine yAxisId="left" y={200} stroke={SEVERITY_THEME.severe.chartFill} strokeDasharray="3 3" opacity={0.4} />

            {nowPoint && (
              <ReferenceLine
                yAxisId="left"
                x={nowPoint.timestamp}
                stroke="#fbbf24"
                strokeDasharray="2 2"
                opacity={0.5}
                label={{ value: 'NOW', position: 'top', fill: '#fbbf24', fontSize: 10, fontWeight: 700 }}
              />
            )}

            {/* Past AQI (solid) */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="aqiChart"
              name="US AQI"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="#60a5fa"
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, fill: '#60a5fa', stroke: '#bfdbfe', strokeWidth: 1 }}
              connectNulls={false}
            />

            {/* Forecast AQI (dashed) */}
            {showForecast && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="forecastAqi"
                name="Forecast AQI"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="6 3"
                opacity={0.6}
                dot={false}
                activeDot={{ r: 3, fill: '#60a5fa', stroke: '#bfdbfe', strokeWidth: 1 }}
                connectNulls={false}
              />
            )}

            {/* Past PM2.5 (solid, secondary axis) */}
            {showPm25 && (
              <Line
                yAxisId="pm25"
                type="monotone"
                dataKey="pm25Chart"
                name="PM2.5"
                stroke="#22d3ee"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#22d3ee', stroke: '#a5f3fc', strokeWidth: 1 }}
                connectNulls={false}
              />
            )}

            {/* Forecast PM2.5 (dashed, secondary axis) */}
            {showPm25 && showForecast && (
              <Line
                yAxisId="pm25"
                type="monotone"
                dataKey="forecastPm25"
                name="Forecast PM2.5"
                stroke="#22d3ee"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                opacity={0.6}
                dot={false}
                activeDot={{ r: 3, fill: '#22d3ee', stroke: '#a5f3fc', strokeWidth: 1 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Controls & Legend */}
      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowPm25(!showPm25)} className={`text-[10px] font-bold uppercase tracking-widest ${showPm25 ? 'text-cyan-400' : 'text-gray-500'}`}>[ PM2.5 ]</button>
          <button onClick={() => setShowForecast(!showForecast)} className={`text-[10px] font-bold uppercase tracking-widest ${showForecast ? 'text-blue-400' : 'text-gray-500'}`}>[ Forecast ]</button>
          <span className="text-gray-500 text-[10px]">|</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> AQI
          </span>
          {showPm25 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" /> PM2.5
            </span>
          )}
          {showForecast && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-3 h-0 border-t border-dashed border-blue-400 inline-block" /> Forecast
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: SEVERITY_THEME.low.chartFill, opacity: 0.3 }} />
          Shaded = below AQI {forecast.threshold}
        </span>
      </div>

      {/* Min / Avg / Max / Now summary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono">
        <span className="text-gray-500">Low: <span className="text-emerald-300">{Math.round(minAqi)}</span></span>
        <span className="text-gray-400">Avg: <span className="text-blue-300">{Math.round(avgAqi)}</span></span>
        <span className="text-gray-400">High: <span className="text-amber-300">{Math.round(maxAqiVal)}</span></span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-400">Now: <span className="text-white font-semibold">{nowPoint ? Math.round(nowPoint.usAqi) : '—'}</span></span>
      </div>
    </figure>
  );
}
