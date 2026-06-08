import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function About({ open, onClose }: Props) {
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
        aria-label="About Stormglass"
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-cyan-500/10 border-b border-cyan-500/30 flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">About Stormglass</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">How this works and what you should know</p>
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
          {/* Mission */}
          <section>
            <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-2">Our Mission</h3>
            <p className="text-gray-300 text-[13px] leading-relaxed">
              Stormglass empowers people with chronic health conditions to understand how weather and environmental factors
              affect their symptoms. By tracking barometric pressure, temperature, humidity, air quality, and other environmental
              triggers, we help you prepare and manage your health with greater clarity.
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

          {/* What We Track */}
          <section>
            <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-3">What We Track & Why</h3>
            <p className="text-gray-300 text-[12px] leading-relaxed mb-3">
              These aren't random. They're based on medical research and what people actually report.
            </p>
            <div className="space-y-3">
              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Headaches</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>Migraine:</strong> Barometric pressure changes (when it drops quickly) are a major trigger for many people.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Cluster Headache:</strong> Seasonal patterns and pressure changes seem to affect clusters.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Sinus Pressure:</strong> Humidity, temperature, and pollen all play a role in sinus symptoms.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Heart & Blood Pressure Issues</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>POTS:</strong> Heat, cold, and humidity all make it harder for your body to regulate heart rate and blood pressure.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Joint & Muscle Pain</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>Arthritis:</strong> Cold, humidity, and pressure changes can make joints swell and feel stiff.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Fibromyalgia:</strong> Weather changes and temperature swings often trigger flares.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Connective Tissue Conditions</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>EDS:</strong> Temperature and humidity changes affect how your tissues respond.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Raynaud's:</strong> Cold is the main trigger—wind makes it worse.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Chronic Fatigue</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>ME/CFS:</strong> Unstable weather and big environmental swings can trigger fatigue and post-activity crashes.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Sleep & Air Quality</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>Sleep:</strong> Temperature, humidity, and even solar activity can mess with sleep.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Air Quality:</strong> Pollution and particulates irritate lungs and trigger inflammation.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-gray-200 mb-1">Allergies</h4>
                <p className="text-[12px] text-gray-400">
                  <strong>Pollen & Mold:</strong> High pollen counts trigger allergy symptoms and can worsen asthma.
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  <strong>Geomagnetic Activity:</strong> Some people notice they feel worse during solar storms. We include it if you want to track it.
                </p>
              </div>
            </div>
          </section>

          {/* Research Basis */}
          <section>
            <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-3">Based On Research</h3>
            <p className="text-gray-300 text-[12px] leading-relaxed mb-2">
              These aren't just guesses. They're based on medical studies and what people report:
            </p>
            <ul className="space-y-2 text-[12px] text-gray-400">
              <li className="flex gap-2">
                <span className="text-cyan-400 shrink-0">•</span>
                <span><strong>Pressure & Migraines:</strong> Studies show that pressure drops trigger migraines in a lot of people.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 shrink-0">•</span>
                <span><strong>Cold & Joint Pain:</strong> Research confirms cold weather makes joint pain and arthritis worse.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 shrink-0">•</span>
                <span><strong>Humidity & Arthritis:</strong> Humid weather increases arthritis pain for many people.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 shrink-0">•</span>
                <span><strong>Air Pollution:</strong> Poor air quality makes asthma, breathing, and overall health worse.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 shrink-0">•</span>
                <span><strong>Pollen:</strong> High pollen counts trigger allergies and asthma attacks.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 shrink-0">•</span>
                <span><strong>Temperature & Sleep:</strong> Extreme temperatures mess with sleep quality.</span>
              </li>
            </ul>
          </section>

          {/* How to Use */}
          <section>
            <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-[0.15em] mb-3">How to Use Stormglass</h3>
            <ol className="space-y-2 text-[12px] text-gray-400 list-decimal list-inside">
              <li><strong>Select Your Conditions:</strong> During onboarding, choose which conditions affect you.</li>
              <li><strong>Monitor Risk Levels:</strong> Check daily health impact forecasts to anticipate symptom patterns.</li>
              <li><strong>Log Symptoms:</strong> Track your actual symptoms to correlate them with weather and environmental changes.</li>
              <li><strong>Plan Ahead:</strong> Use risk forecasts to prepare (e.g., taking medication early, adjusting activity, staying hydrated).</li>
              <li><strong>Validate Patterns:</strong> Over time, you'll learn which factors affect you most—use this to personalize your care.</li>
            </ol>
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

          {/* Privacy Note */}
          <section className="text-[12px] text-gray-400 border-t border-gray-700/30 pt-4">
            <strong>Privacy:</strong> Stormglass stores all data locally on your device. Weather and location data are fetched from public weather APIs but not linked to personal health logs.
            For details, see our Data Sources section.
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
