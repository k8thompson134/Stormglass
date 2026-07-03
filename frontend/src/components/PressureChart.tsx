import { useState, useMemo } from 'react';
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
  Dot,
  Label
} from 'recharts';
import type { WeatherPoint } from '../services/api';
import { classifyPressureRate, computeEventSeverity, SEVERITY_THEME, type EnvSeverity } from '../utils/severity';

interface Props {
  data: WeatherPoint[];
  loading: boolean;
  hours: number;
  onHoursChange: (hours: number) => void;
}

const TIME_RANGES = [
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
  { label: '7d', value: 168 },
];

function formatTime(isoString: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDate(isoString: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  } catch { return ''; }
}

function deltaColor(delta: number | null): string {
  const severity = classifyPressureRate(delta);
  if (!severity) return '#374151';
  return SEVERITY_THEME[severity].chartFill;
}

function deltaLabel(delta: number | null): { text: string; color: string } {
  if (delta === null || isNaN(delta)) return { text: 'No data', color: '#6b7280' };
  const severity = classifyPressureRate(delta);
  const dir = delta > 0.01 ? '↑ Rising' : delta < -0.01 ? '↓ Falling' : '→ Stable';
  const color = severity ? SEVERITY_THEME[severity].chartFill : '#6b7280';
  const level = severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : 'No data';
  return { text: severity ? `${dir} (${level})` : 'No data', color };
}

function formatTooltipDate(label: string): string {
  if (!label) return '';
  try {
    const d = new Date(label);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

interface ValidDataPoint extends WeatherPoint {
  pressureNum: number;
  tempNum: number;
}

interface ChartDataPoint extends ValidDataPoint {
  pressureChart?: number;
  temperatureF?: number;
  forecastPressure?: number;
  forecastTemperatureF?: number;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  name: string;
  payload: ChartDataPoint;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const pressureEntry = payload.find((e) => e.dataKey === 'pressureChart' && e.value != null)
    || payload.find((e) => e.dataKey === 'forecastPressure' && e.value != null);
  const tempEntry = payload.find((e) => e.dataKey === 'temperatureF' && e.value != null)
    || payload.find((e) => e.dataKey === 'forecastTemperatureF' && e.value != null);
  const deltaEntry = payload.find((e) => e.dataKey === 'delta1h');
  const isForecast = payload.some((e) => e.dataKey === 'forecastPressure' && e.value != null
    && !payload.some((p) => p.dataKey === 'pressure' && p.value != null));
  const delta = deltaEntry?.value ?? null;
  const { text: severityText, color: severityColor } = deltaLabel(delta);

  return (
    <div className="bg-gray-950/95 border border-gray-700/50 rounded-lg p-3 text-xs shadow-2xl backdrop-blur-sm min-w-[180px]">
      <p className="text-gray-400 font-semibold mb-2 text-[11px] tracking-wide">
        {isForecast && <span className="text-cyan-400 mr-1.5">FORECAST</span>}
        {formatTooltipDate(label || '')}
      </p>
      <div className="space-y-1.5">
        {pressureEntry && (
          <div className="flex justify-between gap-6">
            <span className="text-gray-400">Pressure</span>
            <span className="text-white font-mono font-medium">{pressureEntry.value?.toFixed(1)} hPa</span>
          </div>
        )}
        {tempEntry && (
          <div className="flex justify-between gap-6">
            <span className="text-gray-400">Temperature</span>
            <span className="text-white font-mono font-medium">{tempEntry.value?.toFixed(1)}°F</span>
          </div>
        )}
        {delta !== null && (
          <>
            <div className="border-t border-gray-700/50 pt-1.5 mt-1.5">
              <div className="flex justify-between gap-6">
                <span className="text-gray-400">Δ Rate</span>
                <span className="font-mono font-medium" style={{ color: severityColor }}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(2)} hPa/h
                </span>
              </div>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-400">Trend</span>
              <span className="font-medium" style={{ color: severityColor }}>{severityText}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Custom dot to show "now" marker on the current data point
function NowDot(props: { cx?: number; cy?: number; payload?: ChartDataPoint; nowPoint?: ValidDataPoint | null }) {
  const { cx, cy, payload, nowPoint } = props;
  if (!nowPoint || !payload?.timestamp || payload.timestamp !== nowPoint.timestamp) return null;
  return (
    <Dot cx={cx} cy={cy} r={4} fill="#fbbf24" stroke="#fef3c7" strokeWidth={1} />
  );
}

export default function PressureChart({ data, loading, hours, onHoursChange }: Props) {
  const [showTemp, setShowTemp] = useState(true);
  const [showForecast, setShowForecast] = useState(false);

  // Filter and validate all data (past + future)
  const validData = useMemo(() => {
    return (Array.isArray(data) ? data : [])
      .filter(d => d && d.timestamp && !isNaN(new Date(d.timestamp).getTime()))
      .map(d => ({
        ...d,
        pressureNum: Number(d.pressure),
        tempNum: Number(d.temperature)
      }))
      .filter(d => !isNaN(d.pressureNum) && d.pressureNum > 800 && d.pressureNum < 1100);
  }, [data]);

  const nowTs = useMemo(() => Date.now(), [data]);

  // Last data point that is at or before "now" – used to trim
  // highlights when forecast is hidden so we stay aligned to
  // actual sample timestamps on the categorical X axis.
  const lastPastTimestamp = useMemo(() => {
    if (!validData.length) return null;
    let last: string | null = null;
    const nowMs = nowTs;
    for (const d of validData) {
      const t = new Date(d.timestamp).getTime();
      if (!Number.isNaN(t) && t <= nowMs) {
        last = d.timestamp;
      }
    }
    return last;
  }, [validData, nowTs]);

  const { pressures, minPressure, maxPressure, avgPressure, minP, maxP } = useMemo(() => {
    if (validData.length === 0) {
      return { pressures: [], minPressure: 0, maxPressure: 0, avgPressure: 0, minP: 0, maxP: 0 };
    }
    const p = validData.map(d => d.pressureNum);
    const min = Math.min(...p);
    const max = Math.max(...p);
    const avg = p.reduce((a, b) => a + b, 0) / p.length;
    return {
      pressures: p,
      minPressure: min,
      maxPressure: max,
      avgPressure: avg,
      minP: Math.floor(min - 1),
      maxP: Math.ceil(max + 1)
    };
  }, [validData]);

  // Calculate temperature range for dedicated axis
  const { minT, maxT } = useMemo(() => {
    if (validData.length === 0) return { minT: 0, maxT: 0 };
    const tempsF = validData.map(d => d.tempNum * 9 / 5 + 32);
    return {
      minT: Math.floor(Math.min(...tempsF) - 5),
      maxT: Math.ceil(Math.max(...tempsF) + 5)
    };
  }, [validData]);

  // Time range info
  const firstTime = useMemo(() => validData.length ? new Date(validData[0].timestamp) : null, [validData]);
  const lastTime = useMemo(() => validData.length ? new Date(validData[validData.length - 1].timestamp) : null, [validData]);

  // Pressure swing
  const pressureSwing = useMemo(() => maxPressure - minPressure, [maxPressure, minPressure]);

  // --- Detect volatile periods for chart highlighting ---
  const volatileZones = useMemo(() => {
    const zones: { start: string; end: string; severity: EnvSeverity; pressureChange: number; score: number }[] = [];

    const MAX_EVENT_HOURS = 18;
    const MAX_GAP_POINTS = 2;

    const finalizeZone = (zoneStartIdx: number | null, zoneEndIdx: number | null, peakIdx: number | null) => {
      if (zoneStartIdx === null || zoneEndIdx === null || zoneEndIdx <= zoneStartIdx) return;

      const baseStartIdx = zoneStartIdx;
      const baseEndIdx = zoneEndIdx;
      const startBase = validData[baseStartIdx];
      const endBase = validData[baseEndIdx];
      if (!startBase || !endBase) return;

      const effectivePeakIdx = peakIdx !== null ? peakIdx : Math.floor((baseStartIdx + baseEndIdx) / 2);
      const peakPoint = validData[effectivePeakIdx];
      if (!peakPoint) return;

      const peakMs = new Date(peakPoint.timestamp).getTime();
      const baseStartMs = new Date(startBase.timestamp).getTime();
      const baseEndMs = new Date(endBase.timestamp).getTime();
      if (Number.isNaN(peakMs) || Number.isNaN(baseStartMs) || Number.isNaN(baseEndMs)) return;

      const halfWindowMs = (MAX_EVENT_HOURS / 2) * 3600000;
      const targetStartMs = Math.max(baseStartMs, peakMs - halfWindowMs);
      const targetEndMs = Math.min(baseEndMs, peakMs + halfWindowMs);
      if (targetEndMs <= targetStartMs) return;

      let clippedStartIdx = baseStartIdx;
      for (let i = baseStartIdx; i <= baseEndIdx; i++) {
        const t = new Date(validData[i].timestamp).getTime();
        if (!Number.isNaN(t) && t >= targetStartMs) {
          clippedStartIdx = i;
          break;
        }
      }

      let clippedEndIdx = baseEndIdx;
      for (let i = baseEndIdx; i >= baseStartIdx; i--) {
        const t = new Date(validData[i].timestamp).getTime();
        if (!Number.isNaN(t) && t <= targetEndMs) {
          clippedEndIdx = i;
          break;
        }
      }
      if (clippedEndIdx <= clippedStartIdx) return;

      let localMaxAbsDelta = 0;
      let localMinP = Infinity;
      let localMaxP = -Infinity;
      for (let i = clippedStartIdx; i <= clippedEndIdx; i++) {
        const d = validData[i];
        const absDelta = Math.abs(d.delta1h ?? 0);
        if (absDelta > localMaxAbsDelta) localMaxAbsDelta = absDelta;
        if (d.pressureNum < localMinP) localMinP = d.pressureNum;
        if (d.pressureNum > localMaxP) localMaxP = d.pressureNum;
      }

      const startTs = new Date(validData[clippedStartIdx].timestamp).getTime();
      const endTs = new Date(validData[clippedEndIdx].timestamp).getTime();
      if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs <= startTs) return;

      const durationHours = Math.max(1, (endTs - startTs) / 3600000);
      const swing = Math.abs(localMaxP - localMinP);
      const lowBelowBaseline = Math.max(0, avgPressure - localMinP);

      const { score, severity: eventSeverity } = computeEventSeverity({
        maxRate: localMaxAbsDelta,
        swing,
        durationHours,
        lowBelowBaseline,
      });

      // Filter out low-intensity events so only meaningful swings appear
      if (eventSeverity === 'low') return;

      zones.push({
        start: validData[clippedStartIdx].timestamp,
        end: validData[clippedEndIdx].timestamp,
        severity: eventSeverity,
        pressureChange: validData[clippedEndIdx].pressureNum - validData[clippedStartIdx].pressureNum,
        score,
      });
    };

    let zoneStartIdx: number | null = null;
    let peakIdx: number | null = null;
    let gapCount = 0;

    for (let i = 0; i < validData.length; i++) {
      const absDelta = Math.abs(validData[i].delta1h ?? 0);
      const sev = classifyPressureRate(absDelta);
      if (sev && sev !== 'low') {
        gapCount = 0;
        if (zoneStartIdx === null) {
          zoneStartIdx = i;
          peakIdx = i;
        } else if (peakIdx === null || absDelta > Math.abs(validData[peakIdx].delta1h ?? 0)) {
          peakIdx = i;
        }
      } else if (zoneStartIdx !== null) {
        gapCount++;
        if (gapCount > MAX_GAP_POINTS) {
          const endIdx = i - 1;
          finalizeZone(zoneStartIdx, endIdx >= zoneStartIdx ? endIdx : zoneStartIdx, peakIdx);
          zoneStartIdx = null;
          peakIdx = null;
          gapCount = 0;
        }
      }
    }

    if (zoneStartIdx !== null) {
      const endIdx = validData.length - 1;
      finalizeZone(zoneStartIdx, endIdx, peakIdx);
    }

    // Trim zones to only show past portion when forecast is off (except on 6h scale)
    if (!showForecast && hours > 6) {
      return zones
        .map(zone => {
          // If we don't know the last past sample, fall back to original behavior
          if (!lastPastTimestamp) return zone;

          const zoneEndMs = new Date(zone.end).getTime();
          const lastPastMs = new Date(lastPastTimestamp).getTime();

          // Cap the event end at the last real past data point so x2
          // always matches an existing category on the X axis.
          const cappedEnd = zoneEndMs > lastPastMs ? lastPastTimestamp : zone.end;

          return {
            ...zone,
            end: cappedEnd,
          };
        })
        // Drop purely future events once forecast is hidden, but keep
        // zones that collapse to a single past timestamp at the boundary.
        .filter(zone => new Date(zone.start).getTime() <= new Date(zone.end).getTime());
    }
    return zones;
  }, [validData, showForecast, hours, nowTs, avgPressure, lastPastTimestamp]);

  // --- Detect front passage (deepest pressure trough) ---
  const frontPassage = useMemo(() => {
    if (pressureSwing < 3 || validData.length < 5) return null;
    let minIdx = 0, minPVal = Infinity;
    for (let i = 0; i < validData.length; i++) {
      const p = validData[i].pressureNum;
      if (p < minPVal) { minPVal = p; minIdx = i; }
    }
    if (minIdx < 2 || minIdx > validData.length - 3) return null;
    return { timestamp: validData[minIdx].timestamp, pressure: minPVal };
  }, [pressureSwing, validData]);

  // Transform data for chart to include Fahrenheit
  // Split data into past (solid) and forecast (dashed) segments
  // The last past point is duplicated as the first forecast point to connect them
  const chartData = useMemo(() => {
    return validData.map(d => {
      const ts = new Date(d.timestamp).getTime();
      const isForecast = ts > nowTs;
      return {
        ...d,
        pressureChart: isForecast ? undefined : d.pressureNum,
        forecastPressure: isForecast ? d.pressureNum : undefined,
        temperatureF: isForecast ? undefined : (d.tempNum * 9 / 5 + 32),
        forecastTemperatureF: isForecast ? (d.tempNum * 9 / 5 + 32) : undefined,
      };
    });
  }, [validData, nowTs]);

  // Bridge: set forecast values on the last past point so the lines connect
  const bridgedChartData = useMemo(() => {
    if (chartData.length === 0) return chartData;
    const result = chartData.map(d => ({ ...d }));
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i].pressureChart !== undefined && result[i + 1].forecastPressure !== undefined) {
        result[i].forecastPressure = result[i].pressureChart;
        result[i].forecastTemperatureF = result[i].temperatureF;
        break;
      }
    }
    // Trim future data when forecast is off, except for 6h scale (6h is short enough)
    if (!showForecast && hours > 6) {
      return result.filter(d => new Date(d.timestamp).getTime() <= nowTs);
    }
    return result;
  }, [chartData, showForecast, hours, nowTs]);

  // Find point closest to actual "Now" for markers
  const nowPoint = useMemo(() => {
    if (validData.length === 0) return null;
    return validData.reduce((prev, curr) => {
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      return Math.abs(currTime - nowTs) < Math.abs(prevTime - nowTs) ? curr : prev;
    }, validData[0]);
  }, [validData, nowTs]);

  // Early return AFTER all hooks to satisfy Rules of Hooks
  if (validData.length === 0) {
    if (loading) return <div className="bg-gray-800/20 rounded-2xl h-[260px] sm:h-[420px] animate-pulse" />;
    return (
      <div className="bg-gray-800/40 rounded-2xl h-[260px] sm:h-[420px] flex items-center justify-center text-gray-400 text-xs uppercase font-bold tracking-widest text-center px-8">
        No Telemetry Data Available for Selected Timeframe
      </div>
    );
  }

  return (
    <figure className="bg-[#131d2e] rounded-2xl p-4 sm:p-6 border border-[#1e2d45] shadow-xl overflow-hidden">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <figcaption>
            <h2 className="text-gray-300 text-sm font-bold uppercase tracking-wider">
              Pressure Dynamics
            </h2>
          </figcaption>
          <div className="flex bg-gray-900/50 p-1 rounded-md shrink-0">
            {TIME_RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => onHoursChange(r.value)}
                aria-pressed={hours === r.value}
                className={`px-3 py-1 text-xs font-bold rounded ${hours === r.value ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info chips */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px]">
            <span className="text-emerald-400 font-bold">↑ Rising</span>
            <span className="text-emerald-300">May bring relief</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px]">
            <span className="text-amber-400 font-bold">↓ Falling</span>
            <span className="text-amber-300">Often triggers flares</span>
          </div>
        </div>
      </div>

      {/* Data summary bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-[11px] font-mono text-gray-400">
        <span>{validData.length} readings</span>
        <span className="text-gray-500">|</span>
        {firstTime && lastTime && (
          <span>
            {firstTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
            {firstTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="text-gray-500">|</span>
        <span>Swing: <span className={pressureSwing > 5 ? 'text-amber-400' : 'text-emerald-400'}>{pressureSwing.toFixed(1)} hPa</span></span>
      </div>

      {/* Weather event highlights */}
      {volatileZones.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-amber-400/80 font-bold uppercase tracking-widest shrink-0">
            <span aria-hidden="true">⚡</span> Events
          </span>
          {volatileZones.map((zone, i) => {
            const zStart = new Date(zone.start);
            const zEnd = new Date(zone.end);
            const hrs = Math.max(1, Math.round((zEnd.getTime() - zStart.getTime()) / 3600000));
            return (
            <div key={i} className={`text-[11px] px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 ${SEVERITY_THEME[zone.severity]?.pill ?? SEVERITY_THEME.low.pill}`}>
                <span className="font-semibold">
                  {zStart.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                  {zStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {zEnd.toLocaleDateString([], { month: 'short', day: 'numeric' }) !== zStart.toLocaleDateString([], { month: 'short', day: 'numeric' }) &&
                    zEnd.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' '
                  }
                  {zEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="opacity-60 text-[10px]">({hrs}h)</span>
                <span className="font-mono">{zone.pressureChange > 0 ? '↗' : '↘'} {Math.abs(zone.pressureChange).toFixed(1)} hPa</span>
                <span className="text-[10px] font-mono opacity-70">
                  {zone.severity.charAt(0).toUpperCase() + zone.severity.slice(1)} · {zone.score}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-[260px] sm:h-[320px] w-full" role="img" aria-label={`Barometric pressure chart showing ${validData.length} readings over the selected time range. Pressure ranges from ${minPressure.toFixed(1)} to ${maxPressure.toFixed(1)} hPa.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={bridgedChartData}>
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
              domain={[minP, maxP]}
              stroke="#4b5563"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={45}
            >
              <Label value="hPa" position="top" offset={10} style={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }} />
            </YAxis>
            <YAxis
              yAxisId="temp"
              orientation="left"
              domain={[minT, maxT]}
              stroke="#fb923c"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              hide={!showTemp}
              width={35}
            >
              <Label value="°F" position="top" offset={10} style={{ fill: '#fb923c', fontSize: 11, fontWeight: 600 }} />
            </YAxis>
            <YAxis yAxisId="delta" orientation="right" domain={[-1.5, 1.5]} hide />

            <Tooltip content={<CustomTooltip />} />

            {/* Average pressure reference line */}
            <ReferenceLine
              yAxisId="left"
              y={avgPressure}
              stroke="#6366f1"
              strokeDasharray="4 4"
              opacity={0.35}
              label={{
                value: `▸ Avg ${avgPressure.toFixed(1)}`,
                position: 'insideLeft',
                fill: '#818cf8',
                fontSize: 10,
                fontWeight: 600,
                offset: 5,
              }}
            />

            {/* Zero line for delta bars */}
            <ReferenceLine yAxisId="delta" y={0} stroke="#374151" strokeDasharray="2 4" opacity={0.4} />

            {/* "Now" Marker Line */}
            {nowPoint && (
              <ReferenceLine
                yAxisId="left"
                x={nowPoint.timestamp}
                stroke="#fbbf24"
                strokeDasharray="2 2"
                opacity={0.4}
                label={{
                  value: 'NOW',
                  position: 'top',
                  fill: '#fbbf24',
                  fontSize: 10,
                  fontWeight: 700,
                  offset: 10
                }}
              />
            )}

            {/* Volatile zone highlighting */}
            {volatileZones.map((zone, i) => (
              <ReferenceArea
                key={`zone-${i}`}
                yAxisId="left"
                x1={zone.start}
                x2={zone.end}
                fill={SEVERITY_THEME[zone.severity]?.chartFill ?? SEVERITY_THEME.low.chartFill}
                fillOpacity={0.07}
                strokeOpacity={0}
              />
            ))}

            {/* Front passage marker */}
            {frontPassage && (
              <ReferenceLine
                yAxisId="left"
                x={frontPassage.timestamp}
                stroke="#fbbf24"
                strokeDasharray="4 3"
                opacity={0.7}
                label={{ value: '▾ Front', position: 'top', fill: '#fbbf24', fontSize: 10, fontWeight: 700 }}
              />
            )}

            {/* Past pressure (solid) */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="pressureChart"
              name="Pressure"
              stroke="#818cf8"
              strokeWidth={2}
              fill="#818cf8"
              fillOpacity={0.06}
              dot={<NowDot nowPoint={nowPoint} />}
              activeDot={{ r: 4, fill: '#818cf8', stroke: '#c7d2fe', strokeWidth: 1 }}
              connectNulls={false}
            />

            {/* Forecast pressure (dashed) */}
            {showForecast && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="forecastPressure"
                name="Forecast"
                stroke="#818cf8"
                strokeWidth={2}
                strokeDasharray="6 3"
                opacity={0.5}
                dot={false}
                activeDot={{ r: 3, fill: '#818cf8', stroke: '#c7d2fe', strokeWidth: 1 }}
                connectNulls={false}
              />
            )}

            {/* Past temperature (solid) */}
            {showTemp && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperatureF"
                name="Temperature"
                stroke="#fb923c"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#fb923c', stroke: '#fed7aa', strokeWidth: 1 }}
                connectNulls={false}
              />
            )}

            {/* Forecast temperature (dashed) */}
            {showTemp && showForecast && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="forecastTemperatureF"
                name="Forecast Temp"
                stroke="#fb923c"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                opacity={0.5}
                dot={false}
                activeDot={{ r: 3, fill: '#fb923c', stroke: '#fed7aa', strokeWidth: 1 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Controls & Legend */}
      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTemp(!showTemp)} className={`text-[10px] font-bold uppercase tracking-widest ${showTemp ? 'text-orange-400' : 'text-gray-500'}`}>[ Temp ]</button>
          <button onClick={() => setShowForecast(!showForecast)} className={`text-[10px] font-bold uppercase tracking-widest ${showForecast ? 'text-cyan-400' : 'text-gray-500'}`}>[ Forecast ]</button>
          <span className="text-gray-500 text-[10px]">|</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" /> Pressure
          </span>
          {showTemp && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> Temp
            </span>
          )}
          {showForecast && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-3 h-0 border-t border-dashed border-indigo-400 inline-block" /> Forecast
            </span>
          )}
        </div>

        <div />
      </div>

      {/* Min / Max summary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono">
        <span className="text-gray-500">Low: <span className="text-blue-300">{minPressure.toFixed(1)}</span></span>
        <span className="text-gray-400">Avg: <span className="text-indigo-300">{avgPressure.toFixed(1)}</span></span>
        <span className="text-gray-400">High: <span className="text-purple-300">{maxPressure.toFixed(1)}</span></span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-400">Now: <span className="text-white font-semibold">{pressures[pressures.length - 1]?.toFixed(1) ?? '—'}</span> hPa</span>
      </div>
    </figure>
  );
}
