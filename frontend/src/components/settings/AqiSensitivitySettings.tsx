import type { HealthToggles } from "../../types/health";
import {
  AQI_SENSITIVITY_OPTIONS,
  type AqiSensitivity,
} from "../../utils/aqiCategory";

interface Props {
  healthToggles: HealthToggles;
  onHealthTogglesChange: (toggles: HealthToggles) => void;
  aqiSensitivity: AqiSensitivity;
  onAqiSensitivityChange: (sensitivity: AqiSensitivity) => void;
}

export default function AqiSensitivitySettings({
  healthToggles,
  onHealthTogglesChange,
  aqiSensitivity,
  onAqiSensitivityChange,
}: Props) {
  return (
    <div className="border-t border-[#1e2d45] pt-5">
      <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
        Air Quality Safety Threshold
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
            healthToggles.aqi
              ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
              : "border-[#1e2d45] bg-[#131d2e]"
          }`}
          aria-hidden
        >
          {healthToggles.aqi && (
            <svg
              className="h-2.5 w-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={healthToggles.aqi}
          onChange={(e) =>
            onHealthTogglesChange({
              ...healthToggles,
              aqi: e.target.checked,
            })
          }
        />
        <span className="text-[11px] text-gray-300">Track air quality</span>
      </label>
      {healthToggles.aqi && (
        <>
          <p className="text-[11px] text-gray-300 mb-3">
            The highest AQI category you consider safe. Used for the safe-window
            callout and chart shading.
          </p>
          <div className="flex bg-[#0f172a] rounded-xl border border-[#1e2d45] p-1 gap-1">
            {AQI_SENSITIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.category}
                type="button"
                onClick={() => onAqiSensitivityChange(opt.category)}
                aria-pressed={aqiSensitivity === opt.category}
                title={`${opt.category} or better counts as "safe" (AQI ≤ ${opt.ceiling})`}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${aqiSensitivity === opt.category ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-white/5"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
