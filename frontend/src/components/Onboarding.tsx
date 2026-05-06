import { useState } from 'react';
import type { HealthToggles, HealthConditionKey } from '../types/health';

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

    const toggle = (key: HealthConditionKey) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(ALL_KEYS));
    const clearAll  = () => setSelected(new Set());

    const handleComplete = () => {
        const toggles = Object.fromEntries(
            ALL_KEYS.map(k => [k, selected.has(k)])
        ) as HealthToggles;
        onComplete(toggles);
    };

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-900 to-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-5">
                    <h1 className="text-2xl font-black tracking-tight text-white mb-1">
                        Welcome to Stormglass
                    </h1>
                    <p className="text-gray-400 text-xs leading-relaxed">
                        Select which health conditions you'd like to track. You can change these anytime in Settings.
                    </p>
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

                {/* Conditions grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5 max-h-[55vh] overflow-y-auto pr-2">
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

                {/* Footer buttons */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleComplete}
                        disabled={selected.size === 0}
                        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200
                            bg-blue-600 hover:bg-blue-500 text-white
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                    >
                        {selected.size === 0 ? 'Select at least one' : `Start with ${selected.size}`}
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
