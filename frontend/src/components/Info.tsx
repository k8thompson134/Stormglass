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
        aria-label="Information"
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tabs */}
        <div className="border-b border-gray-700/50 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-xl font-black text-white tracking-tight">Information</h2>
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
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-gray-800/30 text-gray-400 hover:text-gray-300 border border-gray-700/30'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === 'sources'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-gray-800/30 text-gray-400 hover:text-gray-300 border border-gray-700/30'
              }`}
            >
              Data Sources
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {activeTab === 'about' && (
            <>
              {/* Mission */}
              <section>
                <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.15em] mb-3">Our Mission</h3>
                <p className="text-gray-300 text-[13px] leading-relaxed">
                  Stormglass helps you understand how weather and environment affect your symptoms. By tracking patterns, you can prepare better and manage your health with more clarity.
                </p>
              </section>

              {/* Disclaimer */}
              <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-amber-300 uppercase tracking-[0.15em] mb-2">Important - Please Read</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed">
                  <strong>This is for tracking and awareness, not medical advice.</strong> We show you patterns in how weather and environment might affect your symptoms. But this isn't a diagnosis tool and won't replace talking to a doctor.
                </p>
                <p className="text-gray-300 text-[12px] leading-relaxed mt-2">
                  If your symptoms change or you feel worse, reach out to your doctor. This app is a tool to help you understand patterns—not a replacement for medical care.
                </p>
              </section>

              {/* What We Track & Why */}
              <section>
                <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-3">What We Track & Why</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed mb-3">
                  These aren't random. They're based on medical research and what people actually report.
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Headaches</p>
                    <p className="text-[12px] text-gray-400">Pressure changes, temperature shifts, and seasonal patterns.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Heart & Blood Pressure</p>
                    <p className="text-[12px] text-gray-400">Heat, cold, and humidity affect heart rate and blood pressure regulation.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Joint & Muscle Pain</p>
                    <p className="text-[12px] text-gray-400">Cold, humidity, and pressure changes trigger pain and stiffness.</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-200">Sleep & Air Quality</p>
                    <p className="text-[12px] text-gray-400">Temperature extremes and pollution disrupt sleep.</p>
                  </div>
                </div>
              </section>

              {/* What We Don't Do */}
              <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-red-300 uppercase tracking-[0.15em] mb-2">What This App Is Not</h3>
                <ul className="space-y-1 text-[12px] text-gray-400">
                  <li>Not a diagnosis tool. We can't tell you what's wrong with you.</li>
                  <li>Not a replacement for your doctor. Your doctor still matters most.</li>
                  <li>Not personalized. We show general patterns that might apply to you—your own body is unique.</li>
                  <li>Not sending your data anywhere. Everything stays on your phone. That's it.</li>
                </ul>
              </section>
            </>
          )}

          {activeTab === 'sources' && (
            <>
              {/* Privacy */}
              <section>
                <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-2">Your Privacy</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed">
                  <strong>All your symptom logs and health data stay on your phone.</strong> We don't send them anywhere or store them on our servers.
                </p>
                <p className="text-gray-300 text-[12px] leading-relaxed mt-2">
                  Weather data comes from public sources. Your location is only used to get your weather—we don't save it.
                </p>
              </section>

              {/* Data Sources */}
              <section>
                <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-3">Where Weather Data Comes From</h3>
                <div className="space-y-3">
                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Weather</h4>
                    <p className="text-[12px] text-gray-400">Stormglass (uses NOAA and other services). Updates every few hours. Pretty accurate for pressure and temperature.</p>
                  </div>

                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Air Quality</h4>
                    <p className="text-[12px] text-gray-400">EPA and local monitoring stations. PM2.5, PM10, and pollution levels. Usually hourly updates.</p>
                  </div>

                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Pollen</h4>
                    <p className="text-[12px] text-gray-400">Monitoring networks and weather models. Estimates of tree, grass, weed, and mold pollen.</p>
                  </div>

                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                    <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Solar Activity</h4>
                    <p className="text-[12px] text-gray-400">NOAA Space Weather. Some people notice they feel worse during solar storms—it's not proven yet.</p>
                  </div>
                </div>
              </section>

              {/* Things to Know */}
              <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-amber-300 uppercase tracking-[0.15em] mb-3">Things to Know</h3>
                <ul className="space-y-2 text-[12px] text-gray-400">
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">1.</span>
                    <span>Weather is local. Our data covers a wide area—your neighborhood might be different.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">2.</span>
                    <span>Forecasts get less accurate beyond 2 days out.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">3.</span>
                    <span>Everyone's different. We show general patterns—track what actually affects you.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">4.</span>
                    <span>Stress, sleep, food, and being sick all affect your symptoms too—not just weather.</span>
                  </li>
                </ul>
              </section>

              {/* Feedback */}
              <section className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-4">
                <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em] mb-2">Feedback</h3>
                <p className="text-gray-300 text-[12px] leading-relaxed">
                  Found something wrong or have a suggestion? Let us know.
                </p>
                <p className="text-gray-400 text-[11px] mt-2">
                  Email: <a href="mailto:katethompson134@gmail.com" className="text-blue-400 hover:underline">katethompson134@gmail.com</a>
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
