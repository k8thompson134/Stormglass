import {
  HEALTH_CONDITIONS,
  type HealthToggles,
  type HealthConditionKey,
} from "../../types/health";

interface Props {
  healthToggles: HealthToggles;
  onHealthTogglesChange: (toggles: HealthToggles) => void;
}

export default function HealthConditionSettings({
  healthToggles,
  onHealthTogglesChange,
}: Props) {
  return (
    <div>
      <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
        Health Factors Shown
      </label>
      <p className="text-[11px] text-gray-300 mb-3">
        Choose which conditions to show in the Health Impact Forecast.
      </p>
      <div className="bg-[#0f172a] rounded-xl border border-[#1e2d45] overflow-hidden">
        {HEALTH_CONDITIONS.map((key) => {
          const labels: Record<HealthConditionKey, string> = {
            migraine: "Migraines",
            cluster: "Cluster Headache",
            sinus: "Sinus / Sinusitis",
            pots: "POTS / Dysautonomia",
            mecfs: "ME/CFS / PEM",
            joints: "Joint Pain (Arthritis)",
            fibromyalgia: "Fibromyalgia",
            eds: "EDS / Hypermobility",
            raynauds: "Raynaud's",
            sleep: "Sleep Quality",
            aqi: "Air Quality",
            geomagnetic: "Geomagnetic Storms",
            pollen: "Pollen & Mold",
          };
          const label = labels[key];
          const isOn = healthToggles[key];
          return (
            <label
              key={key}
              className={`
                                    flex items-center gap-3 cursor-pointer select-none
                                    px-4 py-3 border-b border-[#1e2d45] last:border-b-0
                                    transition-colors duration-200
                                    hover:bg-blue-500/5
                                    ${isOn ? "bg-blue-500/10" : ""}
                                `}
            >
              <span
                className={`
                                        flex h-4 w-4 shrink-0 items-center justify-center rounded border
                                        transition-colors duration-200
                                        ${
                                          isOn
                                            ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                                            : "border-[#1e2d45] bg-[#131d2e]"
                                        }
                                    `}
                aria-hidden
              >
                {isOn && (
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
                checked={isOn}
                onChange={(e) =>
                  onHealthTogglesChange({
                    ...healthToggles,
                    [key]: e.target.checked,
                  })
                }
              />
              <span className="text-sm font-medium text-gray-200">{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
