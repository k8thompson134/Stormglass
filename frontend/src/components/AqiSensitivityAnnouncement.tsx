import { AQI_SENSITIVITY_OPTIONS, type AqiSensitivity } from '../utils/aqiCategory';

interface Props {
    onChoose: (sensitivity: AqiSensitivity) => void;
}

// One-time announcement for people who finished onboarding before this preference
// existed (detected in App.tsx by "onboarding done, but no sensitivity stored yet").
// Picking an option here both sets the preference and dismisses the card -- there's
// no separate "confirm" step, since this is meant to be quick, not a detour.
export default function AqiSensitivityAnnouncement({ onChoose }: Props) {
    return (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 sm:p-5">
            <p className="text-blue-300 text-sm font-semibold mb-1">New: air quality safety threshold</p>
            <p className="text-[12px] text-gray-300 leading-relaxed mb-4">
                You can now set which air quality level counts as "safe" for you — it drives the safe-window callout
                and chart shading on the Air Quality card. Pick one below (you can change it anytime in Settings):
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                {AQI_SENSITIVITY_OPTIONS.map(opt => (
                    <button
                        key={opt.category}
                        type="button"
                        onClick={() => onChoose(opt.category)}
                        className="flex-1 text-left px-4 py-3 rounded-lg border border-blue-500/20 bg-gray-900/30 hover:bg-blue-500/15 hover:border-blue-500/40 transition-colors min-h-[44px]"
                    >
                        <div className="text-sm font-medium text-white">{opt.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                            {opt.category} or better counts as safe (AQI ≤ {opt.ceiling})
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
