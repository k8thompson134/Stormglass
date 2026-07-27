import { AQI_SENSITIVITY_OPTIONS, type AqiSensitivity } from '../utils/aqiCategory';

interface Props {
    onChoose: (sensitivity: AqiSensitivity) => void;
    onOptOut: () => void;
}

// One-time announcement for anyone who finished onboarding before this preference
// existed (detected in App.tsx by "onboarding done, but no sensitivity stored yet"),
// shown regardless of whether they currently track Air Quality -- someone who
// skipped it originally may still want it now, and someone who has it on may want
// to turn it off here instead of hunting through Settings. Picking a threshold turns
// Air Quality on with that setting; opting out turns it off. Either way this both
// sets the preference and dismisses the card -- no separate "confirm" step.
export default function AqiSensitivityAnnouncement({ onChoose, onOptOut }: Props) {
    return (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 sm:p-5">
            <p className="text-blue-300 text-sm font-semibold mb-1">New: Air quality safety threshold</p>
            <p className="text-[12px] text-gray-300 leading-relaxed mb-4">
                Choose the highest air quality level you consider safe. It sets the safe-window callout and chart shading on the Air Quality card. You can change this anytime in Settings.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
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
            <button
                type="button"
                onClick={onOptOut}
                className="text-[11px] text-gray-400 hover:text-gray-300 transition-colors"
            >
                Don't track air quality
            </button>
        </div>
    );
}
