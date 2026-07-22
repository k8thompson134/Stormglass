import type { CurrentWeather, WeatherPoint } from '../services/api';
import { toF } from '../utils/conversions';
import { classifyPressureRate, SEVERITY_THEME, type EnvSeverity } from '../utils/severity';

interface Props {
  data: CurrentWeather | null;
  loading: boolean;
  history?: WeatherPoint[];
}
function severityLabel(severity: EnvSeverity, trend: string): string {
  if (severity === 'severe') return trend === 'falling' ? 'Severe Drop' : 'Severe Rise';
  if (severity === 'high') return trend === 'falling' ? 'Sharp Drop' : 'Sharp Rise';
  if (severity === 'moderate') return trend === 'falling' ? 'Dropping' : 'Rising';
  return 'Stable';
}

function severityConfig(severity: EnvSeverity) {
  return SEVERITY_THEME[severity].badge;
}

function trendIcon(trend: string) {
  if (trend === 'falling') return '↓';
  if (trend === 'rising') return '↑';
  return '→';
}

export default function CurrentConditions({ data, loading, history }: Props) {
  if (loading) {
    return (
      <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-5 border border-gray-700/30 animate-pulse">
        <div className="flex items-center gap-8">
          <div className="h-14 bg-gray-700/50 rounded w-48" />
          <div className="flex-1 flex gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-700/30 rounded-lg flex-1" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-5 border border-gray-700/30 flex items-center justify-center h-24">
        <p className="text-gray-400 text-sm">Waiting for data...</p>
      </div>
    );
  }

  const trend = data.derivative?.trend || 'stable';
  const delta1h = data.derivative?.delta1h ?? 0;
  const severity = classifyPressureRate(delta1h) ?? 'low';
  const config = severityConfig(severity);

  // "What changed" context from history
  const context = (() => {
    if (!history || history.length < 3) return null;
    const pressures = history.map(h => Number(h.pressure)).filter(p => !isNaN(p) && p > 800);
    const temps = history.map(h => Number(h.temperature)).filter(t => !isNaN(t));
    if (pressures.length < 3 || temps.length < 3) return null;
    const highP = Math.max(...pressures);
    const lowP = Math.min(...pressures);
    const highT = Math.max(...temps);
    const lowT = Math.min(...temps);
    const pChange = data.pressure - highP;
    return { highP, lowP, highTF: toF(highT), lowTF: toF(lowT), pChange, pRange: highP - lowP, tRange: highT - lowT };
  })();

  return (
    <div className="bg-[#131d2e] rounded-2xl p-5 border border-[#1e2d45] shadow-xl relative overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gray-300 text-xs sm:text-sm font-medium tracking-wider uppercase">Current Conditions</h2>
        <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono">
          {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Pressure - Primary */}
      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl sm:text-4xl font-bold text-white tracking-tight">{data.pressure.toFixed(1)}</span>
          <span className="text-base sm:text-sm text-gray-400 font-medium">hPa</span>
          <span
            className={`ml-auto px-3 py-1.5 rounded-lg text-[11px] sm:text-[10px] font-bold border ${config.bg} ${config.text} ${config.border} ${config.shadow} transition-shadow`}
            role="status"
            aria-label={`Pressure change severity: ${severity}. ${severityLabel(severity, trend)} over the last hour.`}
          >
            {trendIcon(trend)} {severityLabel(severity, trend)}
          </span>
        </div>
        <p className={`text-sm sm:text-xs font-medium mt-2 ${config.text}`}>
          {delta1h >= 0 ? '+' : ''}{delta1h.toFixed(2)} hPa/h
          <span className="text-gray-500 text-[11px] sm:text-[10px] font-normal ml-1">last hour</span>
        </p>
      </div>

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-2">
        <div className="bg-gray-900/40 rounded-lg p-3.5 sm:p-2.5 border border-gray-700/30">
          <p className="text-[11px] sm:text-[10px] text-gray-400 font-mono uppercase tracking-widest">Temp</p>
          <p className="text-lg sm:text-base font-bold text-gray-200 mt-1 sm:mt-0.5">{toF(data.temperature)}<span className="text-sm sm:text-xs text-gray-400 font-normal">°F</span></p>
        </div>
        <div className="bg-gray-900/40 rounded-lg p-3.5 sm:p-2.5 border border-gray-700/30">
          <p className="text-[11px] sm:text-[10px] text-gray-500 font-mono uppercase tracking-widest">Humidity</p>
          <p className="text-lg sm:text-base font-bold text-gray-200 mt-1 sm:mt-0.5">{data.humidity.toFixed(0)}<span className="text-sm sm:text-xs text-gray-500 font-normal">%</span></p>
        </div>
        <div className="bg-gray-900/40 rounded-lg p-3.5 sm:p-2.5 border border-gray-700/30">
          <p className="text-[11px] sm:text-[10px] text-gray-400 font-mono uppercase tracking-widest">Dew Point</p>
          <p className="text-lg sm:text-base font-bold text-gray-200 mt-1 sm:mt-0.5">{toF(data.dewPoint)}<span className="text-sm sm:text-xs text-gray-400 font-normal">°F</span></p>
        </div>
        <div className="bg-gray-900/40 rounded-lg p-3.5 sm:p-2.5 border border-gray-700/30">
          <p className="text-[11px] sm:text-[10px] text-gray-400 font-mono uppercase tracking-widest">Wind</p>
          <p className="text-lg sm:text-base font-bold text-gray-200 mt-1 sm:mt-0.5">{data.windSpeed.toFixed(1)} <span className="text-[11px] sm:text-[10px] text-gray-400 font-normal">m/s</span></p>
        </div>
      </div>

      {/* Bottom info strips */}
      <div className="mt-4 pt-0 space-y-0">
        {/* "What Changed" context strip */}
        {context && context.pRange >= 2 && (
          <div className="border-t border-gray-700/20 py-3 sm:py-2.5 text-[11px] sm:text-[10px] font-mono space-y-1">
            <div className={`font-semibold flex items-center justify-between ${Math.abs(context.pChange) >= 3 ? 'text-amber-400' : 'text-blue-400'}`}>
              <span>{context.pChange > 0 ? '↑' : '↓'} {Math.abs(context.pChange).toFixed(1)} hPa vs High</span>
              {context.tRange >= 5 && <span className="text-gray-400">{context.lowTF}° – {context.highTF}°F</span>}
            </div>
            <div className="text-gray-500">
              <span>Range: {context.lowP.toFixed(1)} – {context.highP.toFixed(1)} hPa</span>
            </div>
          </div>
        )}

        {/* AQI inline */}
        {data.aqi && (() => {
          const hyperlocal = data.aqi.hyperlocal;
          // Match getAQIRisk's logic: take the worse of model vs. hyperlocal so the
          // headline number here agrees with the severity used in the risk card,
          // rather than always showing the (possibly lower) regional-model value.
          const effectiveAqi = hyperlocal ? Math.max(data.aqi.usAqi, hyperlocal.usAqi) : data.aqi.usAqi;
          const usingHyperlocal = hyperlocal ? hyperlocal.usAqi >= data.aqi.usAqi : false;

          return (
          <div className="border-t border-gray-700/20 py-3 sm:py-2.5 flex items-center justify-between flex-wrap gap-2 sm:gap-1.5 text-[11px] sm:text-[10px]">
            <div className="flex items-center gap-2 sm:gap-1.5">
              <span className="text-gray-400 font-mono uppercase tracking-wider text-[11px] sm:text-[10px]">AQI</span>
              <span className={`font-bold text-lg sm:text-base ${effectiveAqi >= 200 ? 'text-red-300' :
                effectiveAqi >= 150 ? 'text-orange-300' :
                  effectiveAqi >= 100 ? 'text-amber-300' :
                    effectiveAqi >= 51 ? 'text-yellow-300' : 'text-emerald-300'
                }`}>
                {effectiveAqi.toFixed(0)}
              </span>
              <span className={`font-bold uppercase px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-lg text-[11px] sm:text-[10px] border transition-all ${effectiveAqi >= 200 ? 'bg-red-500/20 text-red-300 border-red-500/35' :
                effectiveAqi >= 150 ? 'bg-orange-500/20 text-orange-300 border-orange-500/35' :
                  effectiveAqi >= 100 ? 'bg-amber-500/20 text-amber-300 border-amber-500/35' :
                    effectiveAqi >= 51 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/35' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                }`}>
                {effectiveAqi >= 200 ? 'V. Unhealthy' : effectiveAqi >= 150 ? 'Unhealthy' :
                  effectiveAqi >= 100 ? 'Sensitive' : effectiveAqi >= 51 ? 'Moderate' : 'Good'}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-gray-500 font-mono text-[11px] sm:text-[10px]">PM2.5: {data.aqi.pm25.toFixed(1)} · PM10: {data.aqi.pm10.toFixed(1)}</span>
              {hyperlocal ? (
                <span className="font-mono text-[10px] sm:text-[9px]">
                  <span className={usingHyperlocal ? 'text-gray-300 font-semibold' : 'text-gray-600'}>
                    {hyperlocal.sensorCount} sensor{hyperlocal.sensorCount === 1 ? '' : 's'} ({hyperlocal.nearestMiles.toFixed(1)}mi): {hyperlocal.usAqi}
                  </span>
                  {hyperlocal.sensorCount < 3 && (
                    <span className="text-amber-500/70" title="Fewer than the usual 3 nearest sensors -- lower confidence"> (low confidence)</span>
                  )}
                  <span className="text-gray-600"> · </span>
                  <span className={!usingHyperlocal ? 'text-gray-300 font-semibold' : 'text-gray-600'}>
                    model: {data.aqi.usAqi.toFixed(0)}
                  </span>
                  <span className="text-gray-600"> (using higher)</span>
                </span>
              ) : (
                <span className="text-gray-600 font-mono text-[10px] sm:text-[9px]">Regional model only</span>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
