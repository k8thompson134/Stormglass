import { useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Info({ open, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'sources'>('about');
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
        aria-label="About Stormglass"
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tabs */}
        <div className="border-b border-gray-700/50 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-white text-sm font-bold uppercase tracking-wider">About Stormglass</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center hover:bg-gray-800/50 rounded-lg"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === 'about'
                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                  : 'bg-gray-800/30 text-gray-400 hover:text-gray-300 border border-gray-700/30'
              }`}
            >
              How It Works
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === 'sources'
                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                  : 'bg-gray-800/30 text-gray-400 hover:text-gray-300 border border-gray-700/30'
              }`}
            >
              Data & Privacy
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {activeTab === 'about' && (
            <>
              {/* Intro */}
              <section>
                <p className="text-gray-300 text-[13px] leading-relaxed">
                  Stormglass tracks environmental conditions alongside your symptoms to help you find patterns over time. When you log a symptom, the app captures a snapshot of what's happening environmentally (pressure, humidity, air quality, temperature, geomagnetic activity) so you can see which conditions tend to coincide with flares.
                </p>
              </section>

              {/* Getting Started */}
              <section>
                <h3 className="text-[11px] font-bold text-violet-300 uppercase tracking-[0.15em] mb-3">Getting Started</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Log symptoms as they come up.</p>
                    <p className="text-[12px] text-gray-400">Each log captures an automatic environmental snapshot alongside your severity rating and symptom tags.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Patterns become visible once you have a few weeks of data to compare against.</p>
                    <p className="text-[12px] text-gray-400">The more consistently you log, the more useful the correlations will be.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">The Trends page ranks your top environmental correlations by strength</p>
                    <p className="text-[12px] text-gray-400">and provides a daily risk estimate to help you plan ahead.</p>
                  </div>
                </div>
              </section>

              {/* Keep in Mind */}
              <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-amber-300 uppercase tracking-[0.15em] mb-2">Keep in Mind</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed">
                  Stormglass is a tracking tool, not medical advice. Environmental conditions are one piece of a much larger picture that includes sleep, stress, activity, food, and illness. What you find here can be a useful starting point for conversations with your care team.
                </p>
              </section>

              {/* Why These Factors */}
              <section>
                <h3 className="text-[11px] font-bold text-emerald-300 uppercase tracking-[0.15em] mb-3">Why These Factors</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Barometric pressure.</p>
                    <p className="text-[12px] text-gray-400">Pressure changes, especially rapid drops, are widely reported as triggers for migraines, joint pain, and autonomic symptoms. Rate of change often matters more than absolute value.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Humidity and dew point.</p>
                    <p className="text-[12px] text-gray-400">These affect how your body regulates temperature and fluid balance. High humidity worsens heat intolerance, and low humidity irritates airways.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Air quality.</p>
                    <p className="text-[12px] text-gray-400">Particulate matter and ozone worsen respiratory symptoms and drive systemic inflammation.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Temperature swings.</p>
                    <p className="text-[12px] text-gray-400">Rapid shifts stress thermoregulation, which is already compromised in conditions like POTS.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Geomagnetic activity.</p>
                    <p className="text-[12px] text-gray-400">Emerging research links solar storms to cardiovascular and autonomic effects. This is included as an exploratory variable since the data is free and easy to collect, making it worth watching even if the science is still developing.</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'sources' && (
            <>
              {/* Privacy */}
              <section className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <h3 className="text-[11px] font-bold text-emerald-300 uppercase tracking-[0.15em] mb-2">Privacy</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed mb-2">
                  All symptom data stays on your device. Nothing is sent to a server or shared with anyone.
                </p>
                <p className="text-gray-300 text-[12px] leading-relaxed">
                  Your location is used only to fetch local weather data and is not stored or tracked.
                </p>
              </section>

              {/* Data Sources */}
              <section>
                <h3 className="text-[11px] font-bold text-violet-300 uppercase tracking-[0.15em] mb-3">Data Sources</h3>
                <div className="space-y-3">
                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Weather</h4>
                    <p className="text-[12px] text-gray-400">Open-Meteo provides pressure, temperature, humidity, dew point, wind, and UV index. Updates are hourly, with 15-minute resolution available in North America. Free, open-source, no API key required.</p>
                  </div>

                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Air Quality</h4>
                    <p className="text-[12px] text-gray-400">The Open-Meteo Air Quality API pulls from Copernicus CAMS models and includes PM2.5, PM10, ozone, NO2, and SO2. Hourly at 11km resolution.</p>
                  </div>

                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Space Weather</h4>
                    <p className="text-[12px] text-gray-400">NOAA's Space Weather Prediction Center provides the Kp index (geomagnetic activity) and solar wind parameters through real-time JSON endpoints.</p>
                  </div>

                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Pollen (planned)</h4>
                    <p className="text-[12px] text-gray-400">The Google Pollen API will provide tree, grass, and weed indices with US coverage at 1km resolution.</p>
                  </div>
                </div>
              </section>

              {/* Limitations */}
              <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-amber-300 uppercase tracking-[0.15em] mb-2">Limitations</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed">
                  Weather data is modeled over a grid rather than measured at your exact location, so conditions in your immediate environment may differ from what the app shows. This is especially true for air quality. Forecasts are most reliable within 48 hours and degrade beyond that.
                </p>
              </section>

              {/* Contact */}
              <section className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em] mb-2">Contact</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed mb-3">
                  Bug reports, feedback, or questions:
                </p>
                <p className="text-gray-400 text-[11px]">
                  <a href="mailto:katethompson134@gmail.com" className="text-violet-400 hover:text-violet-300 transition-colors">katethompson134@gmail.com</a>
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
