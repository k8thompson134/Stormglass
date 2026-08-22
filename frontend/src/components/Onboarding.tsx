import { useState, useRef } from "react";
import {
  HEALTH_CONDITIONS,
  type HealthToggles,
  type HealthConditionKey,
} from "../types/health";
import { geocodeSearch, updateLocation, type GeoResult } from "../services/api";
import {
  AQI_SENSITIVITY_OPTIONS,
  DEFAULT_AQI_SENSITIVITY,
  type AqiSensitivity,
} from "../utils/aqiCategory";
import logo from "../assets/logo.png";

interface Props {
  onComplete: (toggles: HealthToggles, aqiSensitivity: AqiSensitivity) => void;
}

interface Condition {
  key: HealthConditionKey;
  label: string;
  hint: string;
}

interface Group {
  conditions: Condition[];
}

// Groups for UI display during onboarding, organized by related conditions.
// Order matches HEALTH_CONDITIONS to keep toggles consistent across the app.
const GROUPS: Group[] = [
  {
    conditions: [
      { key: "migraine", label: "Migraines", hint: "Pressure" },
      { key: "cluster", label: "Cluster Headache", hint: "Pressure, Light" },
    ],
  },
  {
    conditions: [
      {
        key: "pots",
        label: "POTS / Dysautonomia",
        hint: "Temperature, Pressure",
      },
      { key: "mecfs", label: "ME/CFS / PEM", hint: "Barometric Volatility" },
    ],
  },
  {
    conditions: [
      {
        key: "joints",
        label: "Joint Pain (Arthritis)",
        hint: "Pressure, Humidity",
      },
      {
        key: "fibromyalgia",
        label: "Fibromyalgia",
        hint: "Pressure, Humidity, Cold",
      },
      { key: "eds", label: "EDS / Hypermobility", hint: "Temperature" },
    ],
  },
  {
    conditions: [{ key: "raynauds", label: "Raynaud's", hint: "Cold, Wind" }],
  },
  {
    conditions: [
      {
        key: "sinus",
        label: "Sinus / Sinusitis",
        hint: "Pressure, Humidity, Pollen",
      },
    ],
  },
  {
    conditions: [
      { key: "sleep", label: "Sleep Quality", hint: "Pressure, Temperature" },
    ],
  },
  {
    conditions: [
      { key: "aqi", label: "Air Quality", hint: "Pollution, Ozone" },
      {
        key: "geomagnetic",
        label: "Geomagnetic Storms",
        hint: "Solar Activity",
      },
      { key: "pollen", label: "Pollen & Mold", hint: "Allergen Levels" },
    ],
  },
];

// Use the canonical HEALTH_CONDITIONS order rather than deriving from GROUPS,
// so onboarding always creates toggles in the same order as everywhere else.
const ALL_KEYS = HEALTH_CONDITIONS;

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [selected, setSelected] = useState<Set<HealthConditionKey>>(new Set());
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<GeoResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<GeoResult | null>(
    null,
  );
  const [aqiSensitivity, setAqiSensitivity] = useState<AqiSensitivity>(
    DEFAULT_AQI_SENSITIVITY,
  );
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef("");

  const toggle = (key: HealthConditionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_KEYS));
  const clearAll = () => setSelected(new Set());
  const handleEnableAll = () => {
    const toggles = Object.fromEntries(
      ALL_KEYS.map((k) => [k, true]),
    ) as HealthToggles;
    onComplete(toggles, DEFAULT_AQI_SENSITIVITY);
  };

  const handleLocationQueryChange = (query: string) => {
    setLocationQuery(query);
    latestQueryRef.current = query;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setLocationResults([]);
      return;
    }

    setLocationSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocodeSearch(query);
        // A slower, now-superseded request can resolve after a newer
        // one -- only apply results if this is still the latest query.
        if (latestQueryRef.current !== query) return;
        setLocationResults(results);
      } catch {
        if (latestQueryRef.current === query) setLocationResults([]);
      } finally {
        if (latestQueryRef.current === query) setLocationSearching(false);
      }
    }, 300);
  };

  const handleLocationSelect = (result: GeoResult) => {
    setPendingLocation(result);
    setLocationQuery("");
    setLocationResults([]);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      if (pendingLocation) {
        const name = `${pendingLocation.name}${pendingLocation.state ? `, ${pendingLocation.state}` : ""}`;
        await updateLocation(
          String(pendingLocation.latitude),
          String(pendingLocation.longitude),
          name,
          pendingLocation.timezone ?? undefined,
        );
      }
      const toggles = Object.fromEntries(
        ALL_KEYS.map((k) => [k, selected.has(k)]),
      ) as HealthToggles;
      onComplete(toggles, aqiSensitivity);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl border border-gray-800/60 rounded-xl overflow-hidden bg-gray-900/40 backdrop-blur-sm flex flex-col">
        {/* Left accent stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500/60" />

        <div className="relative p-6 flex-1 overflow-y-auto">
          {/* Header with logo */}
          <div className="text-center mb-6">
            <img
              src={logo}
              alt="Stormglass"
              className="w-8 h-8 mx-auto mb-3 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]"
            />
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">
              Welcome to Stormglass
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-gray-400">
              Barometric Pressure · Health Impact
            </p>
          </div>

          {/* Step indicator (shown on steps 1-3) */}
          {step > 0 && (
            <div
              className="flex justify-center gap-2 mb-5"
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-label={`Step ${step} of 3`}
            >
              <div
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${step >= 1 ? "bg-blue-400" : "bg-gray-600"}`}
              />
              <div
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${step >= 2 ? "bg-blue-400" : "bg-gray-600"}`}
              />
              <div
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${step >= 3 ? "bg-blue-400" : "bg-gray-600"}`}
              />
            </div>
          )}

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4 mb-6">
              <p className="text-gray-300 text-sm leading-relaxed">
                Stormglass monitors how weather and environmental conditions
                affect your health. Real-time barometric pressure, air quality,
                geomagnetic activity, and pollen levels help you understand your
                symptom patterns.
              </p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Built for people with migraines, ME/CFS, POTS, fibromyalgia,
                joint pain, and other conditions where weather patterns trigger
                symptom flares.
              </p>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mt-4">
                <p className="text-blue-300 text-xs font-semibold mb-2">
                  How it works:
                </p>
                <ul className="text-blue-200 text-[11px] space-y-1.5">
                  <li>• Select which conditions affect you</li>
                  <li>• Set your location for local data</li>
                  <li>• See forecast risk levels for the week</li>
                  <li>• Log symptoms to find your patterns</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 1: Condition selection */}
          {step === 1 && (
            <>
              <p className="text-gray-300 text-xs leading-relaxed mb-4">
                Select which conditions affect you. The tags show what we track.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                {GROUPS.flatMap((group) => group.conditions).map((cond) => {
                  const isOn = selected.has(cond.key);
                  return (
                    <button
                      key={cond.key}
                      type="button"
                      onClick={() => toggle(cond.key)}
                      className={`
                                                flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-150
                                                min-h-[44px]
                                                ${
                                                  isOn
                                                    ? "bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/20"
                                                    : "bg-gray-800/30 border border-gray-700/40 hover:bg-gray-800/50 hover:border-gray-700/60"
                                                }
                                            `}
                      aria-pressed={isOn}
                      title={cond.hint}
                    >
                      <span
                        className={`
                                                flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150
                                                ${isOn ? "border-blue-500/60 bg-blue-500/25 text-blue-300" : "border-gray-700/50 bg-gray-900/50"}
                                            `}
                        aria-hidden
                      >
                        {isOn && (
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs font-medium transition-colors ${isOn ? "text-white" : "text-gray-300"}`}
                        >
                          {cond.label}
                        </div>
                        <div className="text-[9px] text-gray-400 font-mono uppercase tracking-tight">
                          {cond.hint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs font-semibold text-blue-300 hover:text-blue-200 transition-colors border border-blue-500/30 hover:border-blue-500/50 px-3 py-1.5 rounded-lg bg-blue-500/5 hover:bg-blue-500/10"
                >
                  Select all
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs font-semibold text-gray-300 hover:text-gray-200 transition-colors border border-gray-700/50 hover:border-gray-600 px-3 py-1.5 rounded-lg bg-gray-800/30 hover:bg-gray-800/50"
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <>
              <p className="text-gray-300 text-xs leading-relaxed mb-5">
                Set your location for local weather data. You can update this in
                Settings anytime.
              </p>

              <div>
                <label
                  htmlFor="location-search"
                  className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400 block mb-3"
                >
                  Your Location
                </label>

                {pendingLocation ? (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300">
                      {pendingLocation.name}
                      {pendingLocation.state && `, ${pendingLocation.state}`}
                      <button
                        onClick={() => setPendingLocation(null)}
                        aria-label={`Remove ${pendingLocation.name}`}
                        className="ml-1 text-blue-400 hover:text-blue-200 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      id="location-search"
                      type="text"
                      placeholder="Search by city or ZIP code..."
                      value={locationQuery}
                      onChange={(e) =>
                        handleLocationQueryChange(e.target.value)
                      }
                      className="w-full bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 mb-2"
                    />
                    {locationSearching && (
                      <div className="text-xs text-gray-300 px-2 py-1">
                        Searching...
                      </div>
                    )}
                    {locationQuery.length >= 2 &&
                      !locationSearching &&
                      locationResults.length === 0 && (
                        <div className="text-xs text-gray-400 px-2 py-1">
                          No results found
                        </div>
                      )}
                    {locationResults.length > 0 && (
                      <div className="bg-gray-800/50 border border-gray-700/40 rounded-lg overflow-hidden">
                        {locationResults.slice(0, 5).map((result, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleLocationSelect(result)}
                            className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700/50 border-b border-gray-700/30 last:border-b-0 transition-colors min-h-[44px] flex items-center"
                          >
                            {result.name}
                            {result.state && `, ${result.state}`}
                            <span className="text-gray-400 ml-1">
                              {result.country}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Step 3: Air quality safety threshold (only relevant if AQI tracking is on) */}
          {step === 3 && (
            <>
              <p className="text-gray-300 text-xs leading-relaxed mb-5">
                What air quality level do you consider "safe" for being outside?
                This drives the safe-window callout on the Air Quality chart.
                You can change it anytime in Settings.
              </p>
              <div className="flex flex-col gap-2">
                {AQI_SENSITIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.category}
                    type="button"
                    onClick={() => setAqiSensitivity(opt.category)}
                    aria-pressed={aqiSensitivity === opt.category}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors min-h-[44px] ${
                      aqiSensitivity === opt.category
                        ? "bg-blue-500/15 border-blue-500/40"
                        : "bg-gray-800/30 border-gray-700/40 hover:bg-gray-800/50 hover:border-gray-700/60"
                    }`}
                  >
                    <div
                      className={`text-sm font-medium ${aqiSensitivity === opt.category ? "text-white" : "text-gray-300"}`}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {opt.category} or better counts as safe (AQI ≤{" "}
                      {opt.ceiling})
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer buttons (sticky) */}
        <div className="border-t border-gray-800/60 p-6 flex flex-col gap-2">
          {step === 0 ? (
            <button
              onClick={() => setStep(1)}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 bg-blue-600 hover:bg-blue-500 text-white"
            >
              Get Started →
            </button>
          ) : step === 1 ? (
            <>
              <button
                onClick={() => setStep(2)}
                disabled={selected.size === 0}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200
                                    bg-blue-600 hover:bg-blue-500 text-white
                                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                {selected.size === 0
                  ? "Select at least one condition"
                  : `Next: Set location →`}
              </button>
              <button
                onClick={handleEnableAll}
                className="w-full py-1.5 text-xs text-gray-300 hover:text-gray-200 transition-colors font-medium"
              >
                Or enable all and customize later
              </button>
            </>
          ) : step === 2 ? (
            <>
              <button
                onClick={() =>
                  selected.has("aqi") ? setStep(3) : handleComplete()
                }
                disabled={saving}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200
                                    bg-blue-600 hover:bg-blue-500 text-white
                                    disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Setting up..."
                  : selected.has("aqi")
                    ? "Next: Air quality →"
                    : `Start with ${selected.size} condition${selected.size !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-1.5 text-xs text-gray-300 hover:text-gray-200 transition-colors font-medium"
              >
                ← Back to conditions
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200
                                    bg-blue-600 hover:bg-blue-500 text-white
                                    disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Setting up..."
                  : `Start with ${selected.size} condition${selected.size !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full py-1.5 text-xs text-gray-300 hover:text-gray-200 transition-colors font-medium"
              >
                ← Back to location
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
