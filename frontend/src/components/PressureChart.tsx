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

interface Props {
  data: WeatherPoint[];
  loading: boolean;
  hours: number;
  onHoursChange: (hours: number) => void;
}

const TIME_RANGES = [
  { label: '1h', value: 1 },
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
  if (delta === null || isNaN(delta)) return '#374151';
  const abs = Math.abs(delta);
  if (abs >= 1.0) return '#f87171';
  if (abs >= 0.5) return '#fbbf24';
  if (abs >= 0.2) return '#60a5fa';
  return '#34d399';
}

function deltaLabel(delta: number | null): { text: string; color: string } {
  if (delta === null || isNaN(delta)) return { text: 'No data', color: '#6b7280' };
  const abs = Math.abs(delta);
  const dir = delta > 0.01 ? '↑ Rising' : delta < -0.01 ? '↓ Falling' : '→ Stable';
  if (abs >= 1.0) return { text: `${dir} (Extreme)`, color: '#f87171' };
  if (abs >= 0.5) return { text: `${dir} (Significant)`, color: '#fbbf24' };
  if (abs >= 0.2) return { text: `${dir} (Moderate)`, color: '#60a5fa' };
  return { text: `${dir} (Stable)`, color: '#34d399' };
}

function formatTooltipDate(label: string): string {
  if (!label) return '';
  try {
    const d = new Date(label);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  name: string;
  payload: any;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const pressureEntry = payload.find((e) => e.dataKey === 'pressure');
  const tempEntry = payload.find((e) => e.dataKey === 'temperatureF');
  const deltaEntry = payload.find((e) => e.dataKey === 'delta1h');
  const delta = deltaEntry?.value ?? null;
  const { text: severityText, color: severityColor } = deltaLabel(delta);

  return (
    <div className="bg-gray-950/95 border border-gray-700/50 rounded-lg p-3 text-xs shadow-2xl backdrop-blur-sm min-w-[180px]">
      <p className="text-gray-400 font-semibold mb-2 text-[11px] tracking-wide">{formatTooltipDate(label || '')}</p>
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
function NowDot(props: { cx?: number; cy?: number; payload?: any; nowPoint?: any }) {
  const { cx, cy, payload, nowPoint } = props;
  if (!nowPoint || !payload?.timestamp || payload.timestamp !== nowPoint.timestamp) return null;
  return (
    <Dot cx={cx} cy={cy} r={4} fill="#fbbf24" stroke="#fef3c7" strokeWidth={1} />
  );
}

export default function PressureChart({ data, loading, hours, onHoursChange }: Props) {
  const [showTemp, setShowTemp] = useState(true);

  // Filter and validate data immediately
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

  if (validData.length === 0) {
    if (loading) return <div className="bg-gray-800/20 rounded-2xl h-[420px] animate-pulse" />;
    return (
      <div className="bg-gray-800/40 rounded-2xl h-[420px] flex items-center justify-center text-gray-500 text-xs uppercase font-bold tracking-widest text-center px-8">
        No Telemetry Data Available for Selected Timeframe
      </div>
    );
  }

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
    const zones: { start: string; end: string; severity: string; pressureChange: number }[] = [];
    let zoneStartIdx: number | null = null;
    let maxAbsDelta = 0;
    let gapCount = 0;
    for (let i = 0; i < validData.length; i++) {
      const absDelta = Math.abs(validData[i].delta1h ?? 0);
      if (absDelta >= 0.3) {
        gapCount = 0;
        if (zoneStartIdx === null) zoneStartIdx = i;
        maxAbsDelta = Math.max(maxAbsDelta, absDelta);
      } else if (zoneStartIdx !== null) {
        gapCount++;
        if (gapCount > 3) {
          const endIdx = i - gapCount;
          const sev = maxAbsDelta >= 1.0 ? 'extreme' : maxAbsDelta >= 0.5 ? 'significant' : 'moderate';
          zones.push({
            start: validData[zoneStartIdx].timestamp,
            end: validData[endIdx].timestamp,
            severity: sev,
            pressureChange: validData[endIdx].pressureNum - validData[zoneStartIdx].pressureNum
          });
          zoneStartIdx = null; maxAbsDelta = 0; gapCount = 0;
        }
      }
    }
    if (zoneStartIdx !== null) {
      const endIdx = validData.length - 1;
      const sev = maxAbsDelta >= 1.0 ? 'extreme' : maxAbsDelta >= 0.5 ? 'significant' : 'moderate';
      zones.push({
        start: validData[zoneStartIdx].timestamp,
        end: validData[endIdx].timestamp,
        severity: sev,
        pressureChange: validData[endIdx].pressureNum - validData[zoneStartIdx].pressureNum
      });
    }
    return zones;
  }, [validData]);

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
  const chartData = useMemo(() => validData.map(d => ({
    ...d,
    pressure: d.pressureNum,
    temperatureF: d.tempNum * 9 / 5 + 32
  })), [validData]);

  // Find point closest to actual "Now" for markers
  const nowPoint = useMemo(() => {
    const nowTs = Date.now();
    return chartData.reduce((prev: any, curr: any) => {
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      return Math.abs(currTime - nowTs) < Math.abs(prevTime - nowTs) ? curr : prev;
    }, chartData[0]);
  }, [chartData]);

  return (
    <div className="bg-[#131d2e] rounded-2xl p-6 border border-[#1e2d45] shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-gray-300 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          Pressure Dynamics
          {validData.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
        </h2>
        <div className="flex bg-gray-900/50 p-1 rounded-md">
          {TIME_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => onHoursChange(r.value)}
              aria-pressed={hours === r.value}
              className={`px-3 py-1 text-xs font-bold rounded ${hours === r.value ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data summary bar */}
      <div className="flex items-center gap-4 mb-4 text-[11px] font-mono text-gray-500">
        <span>{validData.length} readings</span>
        <span className="text-gray-700">|</span>
        {firstTime && lastTime && (
          <span>
            {firstTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
            {firstTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="text-gray-700">|</span>
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
              <div key={i} className={`text-[11px] px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 ${zone.severity === 'extreme' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                zone.severity === 'significant' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-300'
                }`}>
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
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${zone.severity === 'extreme' ? 'bg-red-500/20' :
                  zone.severity === 'significant' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                  }`}>{zone.severity}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-[320px] w-full" role="img" aria-label={`Barometric pressure chart showing ${validData.length} readings over the selected time range. Pressure ranges from ${minPressure.toFixed(1)} to ${maxPressure.toFixed(1)} hPa.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
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
                fill={zone.severity === 'extreme' ? '#ef4444' : zone.severity === 'significant' ? '#f59e0b' : '#60a5fa'}
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

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="pressure"
              name="Pressure"
              stroke="#818cf8"
              strokeWidth={2}
              fill="#818cf8"
              fillOpacity={0.06}
              dot={<NowDot nowPoint={nowPoint} />}
              activeDot={{ r: 4, fill: '#818cf8', stroke: '#c7d2fe', strokeWidth: 1 }}
            />

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
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Controls & Legend */}
      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTemp(!showTemp)} className={`text-[10px] font-bold uppercase tracking-widest ${showTemp ? 'text-orange-400' : 'text-gray-600'}`}>[ Temp ]</button>
          <span className="text-gray-700 text-[10px]">|</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" /> Pressure
          </span>
          {showTemp && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> Temp
            </span>
          )}
        </div>

        <div />
      </div>

      {/* Min / Max summary */}
      <div className="mt-3 flex items-center gap-4 text-[10px] font-mono">
        <span className="text-gray-500">Low: <span className="text-blue-300">{minPressure.toFixed(1)}</span></span>
        <span className="text-gray-500">Avg: <span className="text-indigo-300">{avgPressure.toFixed(1)}</span></span>
        <span className="text-gray-500">High: <span className="text-purple-300">{maxPressure.toFixed(1)}</span></span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">Now: <span className="text-white font-semibold">{pressures[pressures.length - 1]?.toFixed(1) ?? '—'}</span> hPa</span>
      </div>
    </div>
  );
}
