import { useState, useEffect, useCallback } from 'react';
import logo from './assets/logo.png';
import CurrentConditions from './components/CurrentConditions';
import PressureChart from './components/PressureChart';
import HealthImpact from './components/HealthImpact';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import SymptomLogger from './components/SymptomLogger';
import SymptomDebugLog from './components/SymptomDebugLog';
import Info from './components/Info';
import TrendsModal from './components/TrendsModal';
import {
  fetchCurrentWeather,
  fetchWeatherHistory,
  fetchSettings,
  type CurrentWeather,
  type WeatherPoint,
} from './services/api';
import type { HealthToggles } from './types/health';

function App() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [history, setHistory] = useState<WeatherPoint[]>([]);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [symptomLoggerOpen, setSymptomLoggerOpen] = useState(false);
  const [debugLogOpen, setDebugLogOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);

  const allTogglesOn: HealthToggles = {
    migraine: true, cluster: true, sinus: true,
    pots: true, mecfs: true,
    joints: true, fibromyalgia: true, eds: true, raynauds: true,
    sleep: true, aqi: true, geomagnetic: true, pollen: true,
  };
  const allTogglesOff: HealthToggles = Object.fromEntries(
    Object.keys(allTogglesOn).map(k => [k, false])
  ) as HealthToggles;

  const onboardingDone =
    typeof window !== 'undefined' && !!window.localStorage.getItem('stormglass_onboarding_done');

  const [onboardingOpen, setOnboardingOpen] = useState(!onboardingDone);

  const [healthToggles, setHealthToggles] = useState<HealthToggles>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('stormglass_health_toggles') : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<HealthToggles>;
        if (parsed && typeof parsed === 'object') {
          return { ...allTogglesOn, ...parsed };
        }
      } catch { /* fall through */ }
    }
    // New user — start with everything off until onboarding picks their conditions
    return onboardingDone ? allTogglesOn : allTogglesOff;
  });

  const handleOnboardingComplete = async (toggles: HealthToggles) => {
    setHealthToggles(toggles);
    window.localStorage.setItem('stormglass_health_toggles', JSON.stringify(toggles));
    window.localStorage.setItem('stormglass_onboarding_done', '1');
    setOnboardingOpen(false);
    // Reload settings to display the location the user just set
    try {
      const settings = await fetchSettings();
      setLocationName(settings.name);
    } catch {
      // Settings will load on next data refresh
    }
  };

  const loadData = useCallback(async (h: number) => {
    try {
      setLoading(true);
      setError(null);
      const [currentData, historyData, settings] = await Promise.all([
        fetchCurrentWeather(),
        fetchWeatherHistory(h),
        fetchSettings()
      ]);
      setCurrent(currentData);
      setHistory(Array.isArray(historyData?.series) ? historyData.series : []);
      setLocationName(settings.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(hours);

    // Refresh every 5 minutes
    const interval = setInterval(() => loadData(hours), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hours, loadData]);

  // Persist health toggles when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('stormglass_health_toggles', JSON.stringify(healthToggles));
    } catch {
      // ignore persistence errors
    }
  }, [healthToggles]);

  const handleHoursChange = (h: number) => {
    setHours(h);
  };

  const usingDefaultLocation = !locationName;

  if (onboardingOpen) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-slate-900 text-white font-sans selection:bg-blue-500/30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-md font-bold shadow-lg ring-2 ring-white/20">
        Skip to main content
      </a>
      <main id="main-content" className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <header className="mb-4 sm:mb-8 border-b border-gray-800/60 pb-4 sm:pb-6">
          {/* Mobile header (<= md) */}
          <div className="md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={logo}
                  alt="Stormglass logo"
                  className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] shrink-0"
                />
                <span className="text-base font-black tracking-tight text-white truncate">
                  STORMGLASS
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setInfoOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-cyan-500/50 bg-gray-800/40 hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-300 transition-all duration-200 shrink-0"
                aria-label="Information"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              <button
                onClick={() => setSymptomLoggerOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-blue-500/50 bg-gray-800/40 hover:bg-blue-500/15 text-gray-300 hover:text-blue-300 transition-all duration-200 shadow-glow-blue hover:shadow-glow-blue shrink-0"
                aria-label="Log symptom"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </button>
              <button
                onClick={() => setDebugLogOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-cyan-500/50 bg-gray-800/40 hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-300 transition-all duration-200 shrink-0"
                aria-label="View symptom log"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-blue-500/50 bg-gray-800/40 hover:bg-blue-500/15 text-gray-300 hover:text-blue-300 transition-all duration-200 shadow-glow-blue hover:shadow-glow-blue shrink-0"
                aria-label="Open settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-[12px] font-semibold text-blue-300 truncate">
                {locationName || 'Default location'}
              </p>
              <p className="text-[11px] text-gray-400 font-mono uppercase tracking-widest">
                {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              {usingDefaultLocation && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors h-9"
                >
                  Set your location
                </button>
              )}
            </div>
          </div>

          {/* Desktop header (>= md) */}
          <div className="hidden md:block">
            <div className="flex items-start justify-between gap-8">
              {/* Left: logo, title, subtitle, location */}
              <div className="flex items-start gap-4 min-w-0">
                <img
                  src={logo}
                  alt="Stormglass logo"
                  className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    STORMGLASS
                  </h1>
                  <p className="text-[10px] text-gray-400 font-mono uppercase tracking-[0.22em]">
                    Barometric Pressure · Health Impact
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest">
                      {locationName || 'Default location'}
                    </span>
                    {usingDefaultLocation && (
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="text-[10px] font-semibold text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                      >
                        Set your location
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: date + settings */}
              <div className="flex flex-col items-end gap-2 shrink-0 text-right">
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setInfoOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-cyan-500/50 bg-gray-800/40 hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-300 transition-all duration-200"
                    aria-label="Information"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSymptomLoggerOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-blue-500/50 bg-gray-800/40 hover:bg-blue-500/15 text-gray-300 hover:text-blue-300 transition-all duration-200 shadow-glow-blue hover:shadow-glow-blue"
                    aria-label="Log symptom"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <line x1="12" y1="11" x2="12" y2="17" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDebugLogOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-cyan-500/50 bg-gray-800/40 hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-300 transition-all duration-200"
                    aria-label="View symptom log"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-blue-500/50 bg-gray-800/40 hover:bg-blue-500/15 text-gray-300 hover:text-blue-300 transition-all duration-200 shadow-glow-blue hover:shadow-glow-blue"
                    aria-label="Open settings"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" aria-live="assertive" aria-atomic="true" className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Top Section: Chart & Current Conditions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-6">
          <div className="lg:col-span-2 min-w-0">
            <PressureChart
              data={history}
              loading={loading}
              hours={hours}
              onHoursChange={handleHoursChange}
            />
          </div>

          <div className="lg:col-span-1 min-w-0">
            <CurrentConditions data={current} loading={loading} history={history} />
          </div>
        </div>

        {/* Health Impact Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Health Impact</h3>
            <button
              onClick={() => setTrendsOpen(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors px-3 py-1.5 border border-violet-500/30 rounded-lg hover:bg-violet-500/10"
            >
              [ View Trends ]
            </button>
          </div>
          <HealthImpact data={current} loading={loading} healthToggles={healthToggles} />
        </div>

        {/* Settings Modal */}
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onLocationChanged={() => loadData(hours)}
          healthToggles={healthToggles}
          onHealthTogglesChange={setHealthToggles}
        />

        {/* Symptom Logger Modal */}
        <SymptomLogger
          open={symptomLoggerOpen}
          onClose={() => setSymptomLoggerOpen(false)}
          onLogged={() => loadData(hours)}
          selectedConditions={healthToggles}
        />

        {/* Symptom Debug Log Modal */}
        <SymptomDebugLog
          open={debugLogOpen}
          onClose={() => setDebugLogOpen(false)}
        />

        {/* Info Modal */}
        <Info
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
        />

        {/* Trends Modal */}
        <TrendsModal
          open={trendsOpen}
          onClose={() => setTrendsOpen(false)}
          onOpenSymptomLogger={() => setSymptomLoggerOpen(true)}
        />
      </main>
    </div>
  );
}

export default App;
