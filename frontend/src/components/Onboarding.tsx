import { useState, useRef } from 'react';
import type { HealthToggles, HealthConditionKey } from '../types/health';
import { geocodeSearch, updateLocation, type GeoResult } from '../services/api';
import logo from '../assets/logo.png';

interface Props {
    onComplete: (toggles: HealthToggles) => void;
}

interface Condition {
    key: HealthConditionKey;
    label: string;
    hint: string;
}

interface Group {
    heading: string;
    conditions: Condition[];
}

const GROUPS: Group[] = [
    {
        heading: 'Headaches & Neurological',
        conditions: [
            { key: 'migraine',  label: 'Migraines',        hint: 'Barometric pressure changes' },
            { key: 'cluster',   label: 'Cluster Headache', hint: 'Pressure drops + bright light' },
            { key: 'sinus',     label: 'Sinus / Sinusitis', hint: 'Pressure, humidity, pollen' },
        ],
    },
    {
        heading: 'Dysautonomia & Energy',
        conditions: [
            { key: 'pots',  label: 'POTS / Dysautonomia', hint: 'Heat, cold, pressure swings' },
            { key: 'mecfs', label: 'ME/CFS / PEM',         hint: 'Atmospheric volatility' },
        ],
    },
    {
        heading: 'Pain & Connective Tissue',
        conditions: [
            { key: 'fibromyalgia', label: 'Fibromyalgia',        hint: 'Cold, damp, pressure' },
            { key: 'joints',       label: 'Joint Pain (Arthritis)', hint: 'Pressure, cold, humidity' },
            { key: 'eds',          label: 'EDS / Hypermobility',  hint: 'Cold stiffening + heat laxity' },
        ],
    },
    {
        heading: 'Circulation & Temperature',
        conditions: [
            { key: 'raynauds', label: "Raynaud's", hint: 'Cold temperature + wind chill' },
        ],
    },
    {
        heading: 'Respiratory & Immune',
        conditions: [
            { key: 'aqi',    label: 'Air Quality',    hint: 'PM2.5, ozone, pollutants' },
            { key: 'pollen', label: 'Pollen & Mold',  hint: 'Tree, grass, weed, mold indices' },
        ],
    },
    {
        heading: 'General Wellbeing',
        conditions: [
            { key: 'sleep',       label: 'Sleep Quality',     hint: 'Pressure, temp, Kp index, AQI' },
            { key: 'geomagnetic', label: 'Geomagnetic Storms', hint: 'Kp index + solar activity' },
        ],
    },
];

const ALL_KEYS = GROUPS.flatMap(g => g.conditions.map(c => c.key));

export default function Onboarding({ onComplete }: Props) {
    const [selected, setSelected] = useState<Set<HealthConditionKey>>(new Set());
    const [locationQuery, setLocationQuery] = useState('');
    const [locationResults, setLocationResults] = useState<GeoResult[]>([]);
    const [locationSearching, setLocationSearching] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<GeoResult | null>(null);
    const [saving, setSaving] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const toggle = (key: HealthConditionKey) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(ALL_KEYS));
    const clearAll = () => setSelected(new Set());

    const handleLocationQueryChange = (query: string) => {
        setLocationQuery(query);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.length < 2) {
            setLocationResults([]);
            return;
        }

        setLocationSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const results = await geocodeSearch(query);
                setLocationResults(results);
            } catch {
                setLocationResults([]);
            } finally {
                setLocationSearching(false);
            }
        }, 300);
    };

    const handleLocationSelect = (result: GeoResult) => {
        setPendingLocation(result);
        setLocationQuery('');
        setLocationResults([]);
    };

    const handleComplete = async () => {
        setSaving(true);
        try {
            if (pendingLocation) {
                const name = `${pendingLocation.name}${pendingLocation.state ? `, ${pendingLocation.state}` : ''}`;
                await updateLocation(String(pendingLocation.latitude), String(pendingLocation.longitude), name);
            }
            const toggles = Object.fromEntries(
                ALL_KEYS.map(k => [k, selected.has(k)])
            ) as HealthToggles;
            onComplete(toggles);
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
                        <img src={logo} alt="Stormglass" className="w-8 h-8 mx-auto mb-3 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                        <h1 className="text-2xl font-black tracking-tight text-white mb-1">
                            Welcome to Stormglass
                        </h1>
                        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-gray-500 mb-3">
                            Barometric Pressure · Health Impact
                        </p>
                        <p className="text-gray-400 text-xs leading-relaxed mb-3">
                            Stormglass monitors how weather and environmental conditions affect your health. Real-time barometric pressure, air quality, geomagnetic activity, and pollen levels help you understand your symptom patterns.
                        </p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            Select which health conditions you'd like to view. You can change these anytime in Settings.
                        </p>
                    </div>

                    {/* Conditions grid with fade */}
                    <div className="relative mb-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[45vh] overflow-y-auto pr-2">
                    {GROUPS.flatMap(group => group.conditions).map(cond => {
                        const isOn = selected.has(cond.key);
                        return (
                            <button
                                key={cond.key}
                                type="button"
                                onClick={() => toggle(cond.key)}
                                className={`
                                    flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150
                                    ${isOn
                                        ? 'bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/20'
                                        : 'bg-gray-800/30 border border-gray-700/40 hover:bg-gray-800/50 hover:border-gray-700/60'
                                    }
                                `}
                            >
                                {/* Checkbox */}
                                <span className={`
                                    flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150
                                    ${isOn ? 'border-blue-500/60 bg-blue-500/25 text-blue-300' : 'border-gray-700/50 bg-gray-900/50'}
                                `}>
                                    {isOn && (
                                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </span>

                                {/* Label only */}
                                <span className={`text-xs font-medium line-clamp-2 transition-colors ${isOn ? 'text-white' : 'text-gray-300'}`}>
                                    {cond.label}
                                </span>
                            </button>
                        );
                    })}
                        </div>
                        {/* Bottom fade on grid */}
                        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-gray-900 pointer-events-none" />
                    </div>

                    {/* Quick actions */}
                    <div className="flex justify-center gap-2 mb-5">
                    <button
                        onClick={selectAll}
                        className="text-xs font-semibold text-blue-300 hover:text-blue-200 transition-colors border border-blue-500/30 hover:border-blue-500/50 px-3 py-1.5 rounded-lg bg-blue-500/5 hover:bg-blue-500/10"
                    >
                        Select all
                    </button>
                    <button
                        onClick={clearAll}
                        className="text-xs font-semibold text-gray-400 hover:text-gray-300 transition-colors border border-gray-700/50 hover:border-gray-600 px-3 py-1.5 rounded-lg bg-gray-800/30 hover:bg-gray-800/50"
                    >
                        Clear
                    </button>
                    </div>

                    {/* Section divider */}
                    <div className="border-t border-gray-800/60 my-5" />

                    {/* Location section */}
                    <div className="mb-5">
                        <label className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500 block mb-1">
                            Your Location
                        </label>
                        <p className="text-[10px] text-gray-500 mb-3">
                            Used to fetch local pressure, AQI, and pollen data
                        </p>

                        {pendingLocation ? (
                            <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300">
                                    {pendingLocation.name}
                                    {pendingLocation.state && `, ${pendingLocation.state}`}
                                    <button
                                        onClick={() => setPendingLocation(null)}
                                        className="ml-1 text-blue-400 hover:text-blue-200 font-bold"
                                    >
                                        ×
                                    </button>
                                </span>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder="Search for a city or location..."
                                    value={locationQuery}
                                    onChange={(e) => handleLocationQueryChange(e.target.value)}
                                    className="w-full bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 mb-2"
                                />
                                {locationSearching && (
                                    <div className="text-xs text-gray-400 px-2 py-1">Searching...</div>
                                )}
                                {locationQuery.length >= 2 && !locationSearching && locationResults.length === 0 && (
                                    <div className="text-xs text-gray-500 px-2 py-1">No results found</div>
                                )}
                                {locationResults.length > 0 && (
                                    <div className="bg-gray-800/50 border border-gray-700/40 rounded-lg overflow-hidden">
                                        {locationResults.slice(0, 5).map((result, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleLocationSelect(result)}
                                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700/50 border-b border-gray-700/30 last:border-b-0 transition-colors"
                                            >
                                                {result.name}
                                                {result.state && `, ${result.state}`}
                                                <span className="text-gray-500 ml-1">{result.country}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Section divider */}
                    <div className="border-t border-gray-800/60 mb-5" />
                </div>

                {/* Footer buttons (sticky) */}
                <div className="border-t border-gray-800/60 p-6 flex flex-col gap-2">
                    <button
                        onClick={handleComplete}
                        disabled={selected.size === 0 || saving}
                        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200
                            bg-blue-600 hover:bg-blue-500 text-white
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                    >
                        {saving ? 'Setting up...' : selected.size === 0 ? 'Select at least one' : `Start with ${selected.size}`}
                    </button>
                    <button
                        onClick={() => {
                            selectAll();
                            setTimeout(() => {
                                const toggles = Object.fromEntries(ALL_KEYS.map(k => [k, true])) as HealthToggles;
                                onComplete(toggles);
                            }, 0);
                        }}
                        className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors font-medium"
                    >
                        Or enable all and customize later
                    </button>
                </div>
            </div>
        </div>
    );
}
