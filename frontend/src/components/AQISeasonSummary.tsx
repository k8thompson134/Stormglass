import { useEffect, useState } from 'react';
import { fetchAQIBurden, type AQIBurdenSummary } from '../services/api';
import { CATEGORY_ORDER, AQI_CATEGORY_THEME, AQI_SENSITIVITY_OPTIONS, type AqiSensitivity } from '../utils/aqiCategory';

interface Props {
  // Same persisted "safe up to" preference AQIForecastChart uses -- keeps the
  // headline threshold consistent across both AQI surfaces instead of this one
  // silently defaulting to Moderate regardless of what the user actually chose.
  sensitivity: AqiSensitivity;
}

export default function AQISeasonSummary({ sensitivity }: Props) {
  const [summary, setSummary] = useState<AQIBurdenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from "no history yet" -- a real fetch failure shouldn't look identical
  // to a fresh install with nothing tracked yet.
  const [error, setError] = useState(false);
  const ceiling = AQI_SENSITIVITY_OPTIONS.find(opt => opt.category === sensitivity)?.ceiling ?? 100;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAQIBurden(undefined, ceiling)
      .then(result => { if (!cancelled) { setSummary(result); setError(false); } })
      .catch(() => { if (!cancelled) { setSummary(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ceiling]);

  if (loading) {
    return <div className="bg-gray-800/20 rounded-2xl h-[90px] animate-pulse" />;
  }

  if (error) {
    return (
      <div className="bg-[#131d2e] rounded-2xl p-3 border border-gray-700/30 text-[11px] text-gray-500">
        Couldn't load the season summary right now.
      </div>
    );
  }

  // Not enough history yet to say anything meaningful -- rather than show a
  // "0 of 1 days" stat that reads as a claim, just don't render the card.
  if (!summary || summary.totalDaysTracked < 3) {
    return null;
  }

  const { totalDaysTracked, daysAtOrAboveThreshold, threshold, byCategory } = summary;
  const pct = Math.round((daysAtOrAboveThreshold / totalDaysTracked) * 100);
  const isNotable = daysAtOrAboveThreshold > 0;

  // Days at each category, in worst-to-best order, skipping empty tiers -- shows the
  // actual spread of a swingy season (e.g. mostly Good with a couple Hazardous spikes)
  // rather than collapsing everything into a single above/below-100 count.
  const breakdown = [...CATEGORY_ORDER].reverse()
    .map(category => ({ category, days: byCategory?.[category] ?? 0 }))
    .filter(b => b.days > 0);

  return (
    <div className="bg-[#131d2e] rounded-2xl p-4 sm:p-5 border border-[#1e2d45] shadow-xl">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <div>
          <h2 className="text-gray-300 text-xs font-bold uppercase tracking-wider mb-1">
            Last {totalDaysTracked} Days
          </h2>
          <p className="text-[13px] text-gray-300">
            <span className={`font-bold ${isNotable ? 'text-amber-300' : 'text-emerald-300'}`}>
              {daysAtOrAboveThreshold} of {totalDaysTracked} days
            </span>
            {' '}have hit AQI {threshold}+ ({pct}%)
          </p>
        </div>
      </div>

      {breakdown.length > 0 && (
        <>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-800/60">
            {breakdown.map(b => (
              <div
                key={b.category}
                style={{ width: `${(b.days / totalDaysTracked) * 100}%`, backgroundColor: AQI_CATEGORY_THEME[b.category].dot }}
                title={`${b.category}: ${b.days} day${b.days === 1 ? '' : 's'}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {breakdown.map(b => (
              <span key={b.category} className={`text-[10px] font-mono ${AQI_CATEGORY_THEME[b.category].text}`}>
                {AQI_CATEGORY_THEME[b.category].shortLabel}: {b.days}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
