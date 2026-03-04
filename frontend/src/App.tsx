import { useState, useEffect, useCallback } from 'react';
import logo from './assets/logo.png';
import CurrentConditions from './components/CurrentConditions';
import PressureChart from './components/PressureChart';
import HealthImpact from './components/HealthImpact';
import Settings from './components/Settings';
import {
  fetchCurrentWeather,
  fetchWeatherHistory,
  fetchSettings,
  type CurrentWeather,
  type WeatherPoint,
} from './services/api';

function App() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [history, setHistory] = useState<WeatherPoint[]>([]);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const handleHoursChange = (h: number) => {
    setHours(h);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-slate-900 text-white font-sans selection:bg-blue-500/30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-md font-bold shadow-lg ring-2 ring-white/20">
        Skip to main content
      </a>
      <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <header className="mb-4 sm:mb-8 border-b border-gray-800/60 pb-4 sm:pb-6">
          {/* Row 1: Logo + Title + Settings gear */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={logo}
                alt="Stormglass logo"
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] shrink-0"
              />
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                STORMGLASS
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider hidden md:block">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 hover:border-blue-500/50 bg-gray-800/40 hover:bg-blue-500/15 text-gray-400 hover:text-blue-300 transition-all duration-200 shadow-glow-blue hover:shadow-glow-blue"
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
          {/* Row 2: Location badge + subtitle */}
          <div className="flex items-center gap-2 mt-1.5 ml-0 sm:ml-12 lg:ml-[52px] flex-wrap">
            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest break-words max-w-full sm:max-w-none">
              {locationName || 'Live Reading'}
            </span>
            <p className="text-gray-500 text-[10px] font-mono uppercase tracking-[0.2em] hidden sm:block">Barometric Pressure · Health Impact</p>
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider md:hidden">
              {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
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

        {/* Bottom Section: Health Impact */}
        <HealthImpact data={current} loading={loading} />

        {/* Settings Modal */}
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onLocationChanged={() => loadData(hours)}
        />
      </main>
    </div>
  );
}

export default App;
