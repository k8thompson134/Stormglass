import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DataSources({ open, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, modalRef, { onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Data Sources"
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-500/10 border-b border-blue-500/30 flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Data & Sources</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Where the information comes from</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center hover:bg-gray-800/50 rounded-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Overview */}
          <section>
            <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.15em] mb-2">Your Privacy</h3>
            <p className="text-gray-300 text-[12px] leading-relaxed">
              <strong>All your symptom logs and health data stay on your phone.</strong> We don't send them anywhere or store them on our servers.
            </p>
            <p className="text-gray-300 text-[12px] leading-relaxed mt-2">
              Weather data comes from public sources. Your location is only used to get your weather—we don't save it.
            </p>
          </section>

          {/* Weather & Environmental Data */}
          <section>
            <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.15em] mb-3">Where Weather Data Comes From</h3>
            <div className="space-y-4">
              <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Weather</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>From:</strong> Stormglass (uses data from NOAA and other weather services)
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>What we get:</strong> Pressure, temperature, humidity, wind, UV index, and more.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Accuracy:</strong> Usually within a degree or two for temperature, pressure is pretty accurate.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>How often:</strong> Updates every few hours.
                </p>
              </div>

              <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Air Quality</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>From:</strong> EPA and local air quality monitoring stations.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>What we get:</strong> PM2.5, PM10, ozone, and pollution levels.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Coverage:</strong> Mainly North America.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>How often:</strong> Usually hourly, depending on your area.
                </p>
              </div>

              <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Pollen</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>From:</strong> Pollen monitoring networks and weather models.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>What we get:</strong> Tree, grass, weed, and mold pollen levels.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Note:</strong> These are estimates. Your actual exposure depends on where you are and how much time you spend outside.
                </p>
              </div>

              <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Solar Activity</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>From:</strong> NOAA Space Weather Prediction Center.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>What we get:</strong> Solar storm alerts and activity levels.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Note:</strong> Some people say solar storms affect how they feel. It's not proven yet, but we include it if you want to track it.
                </p>
              </div>
            </div>
          </section>

          {/* Limitations & Caveats */}
          <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <h3 className="text-[10px] font-bold text-amber-300 uppercase tracking-[0.15em] mb-3">Things to Know</h3>
            <ul className="space-y-2 text-[12px] text-gray-400">
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold shrink-0">1.</span>
                <span><strong>Weather is local:</strong> Our data covers a wide area. Your exact neighborhood might be different.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold shrink-0">2.</span>
                <span><strong>Forecasts get less accurate:</strong> Predictions more than 2 days out are less reliable.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold shrink-0">3.</span>
                <span><strong>Everyone's different:</strong> What triggers you might not trigger someone else. Use this as a starting point and track what actually affects you.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold shrink-0">4.</span>
                <span><strong>Multiple things matter:</strong> Stress, sleep, food, and being sick all affect your symptoms too—not just weather.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold shrink-0">5.</span>
                <span><strong>Solar storms:</strong> People report feeling worse during solar storms, but it's not proven yet. Experiment and see if it matters for you.</span>
              </li>
            </ul>
          </section>

          {/* Health Impact Models */}
          <section>
            <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.15em] mb-3">Health Impact Model Inputs</h3>
            <p className="text-gray-300 text-[12px] leading-relaxed mb-3">
              The health risk levels in Stormglass are computed from the following data inputs:
            </p>
            <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
              <table className="w-full text-[11px] text-gray-400">
                <thead className="border-b border-gray-600">
                  <tr>
                    <th className="text-left py-2 px-2 text-gray-300 font-semibold">Condition</th>
                    <th className="text-left py-2 px-2 text-gray-300 font-semibold">Primary Triggers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  <tr>
                    <td className="py-2 px-2">Migraine</td>
                    <td className="py-2 px-2">Pressure change (Δ ≥ ±0.5 hPa/h), sustained shifts</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Cluster Headache</td>
                    <td className="py-2 px-2">Pressure change + UV index + temperature extremes</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Sinus Pressure</td>
                    <td className="py-2 px-2">Humidity, temperature, pollen</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">POTS / Dysautonomia</td>
                    <td className="py-2 px-2">Heat/cold stress, humidity, pressure change (combined)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Joint Pain</td>
                    <td className="py-2 px-2">Pressure change (Δ ≥ ±0.5 hPa/h), cold (&lt;10°C), high humidity</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Fibromyalgia</td>
                    <td className="py-2 px-2">Pressure volatility, cold, humidity</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">EDS</td>
                    <td className="py-2 px-2">Temperature extremes, humidity</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Raynaud's</td>
                    <td className="py-2 px-2">Cold (&lt;5°C), wind speed</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">ME/CFS</td>
                    <td className="py-2 px-2">Overall atmospheric volatility (sum of multi-hour changes)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Sleep Quality</td>
                    <td className="py-2 px-2">Temperature, humidity, geomagnetic activity, AQI</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Air Quality</td>
                    <td className="py-2 px-2">US AQI (PM2.5, PM10, pollutants)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Geomagnetic</td>
                    <td className="py-2 px-2">Kp Index (space weather)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">Pollen & Mold</td>
                    <td className="py-2 px-2">Allergen indices (tree, grass, weed, mold)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Attribution & References */}
          <section>
            <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.15em] mb-3">Where We Get This Info</h3>
            <p className="text-gray-300 text-[12px] leading-relaxed mb-2">
              The health models are based on:
            </p>
            <ul className="space-y-1.5 text-[12px] text-gray-400">
              <li>Medical research studies</li>
              <li>Government health agencies (CDC, WHO, EPA)</li>
              <li>What people report—patients know their own bodies best</li>
            </ul>
            <p className="text-gray-300 text-[12px] leading-relaxed mt-3">
              If you want to know more about a specific condition, just ask—we're happy to share what we know.
            </p>
          </section>

          {/* Contact & Feedback */}
          <section className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
            <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em] mb-2">Feedback & Reporting Errors</h3>
            <p className="text-gray-300 text-[12px] leading-relaxed">
              If you notice inaccurate data, a missing data source, or if the health models don't match your experience, please send
              feedback. Your insights help us improve Stormglass.
            </p>
            <p className="text-gray-400 text-[11px] mt-2">
              Email: <a href="mailto:katethompson134@gmail.com" className="text-blue-400 hover:underline">katethompson134@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
