import { useEffect, useState } from 'react';
import { fetchAQIBurden, type AQIBurdenSummary } from '../services/api';

export default function AQISeasonSummary() {
  const [summary, setSummary] = useState<AQIBurdenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from "no history yet" -- a real fetch failure shouldn't look identical
  // to a fresh install with nothing tracked yet.
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAQIBurden()
      .then(result => { if (!cancelled) { setSummary(result); setError(false); } })
      .catch(() => { if (!cancelled) { setSummary(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  const { totalDaysTracked, daysAtOrAboveThreshold, threshold } = summary;
  const pct = Math.round((daysAtOrAboveThreshold / totalDaysTracked) * 100);
  const isNotable = daysAtOrAboveThreshold > 0;

  return (
    <div className="bg-[#131d2e] rounded-2xl p-4 sm:p-5 border border-[#1e2d45] shadow-xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
        <div className="flex gap-0.5 h-2 w-32 rounded-full overflow-hidden bg-gray-800/60">
          <div
            className={isNotable ? 'bg-amber-400' : 'bg-emerald-400'}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
