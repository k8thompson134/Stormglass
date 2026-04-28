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
        <div className="fixed inset-0 z-50 bg-[#0b1220] overflow-y-auto">
            <div className="min-h-full flex flex-col items-center px-4 py-10">
                <div className="w-full max-w-xl">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="text-4xl mb-3">🌩️</div>
                        <h1 className="text-white text-2xl font-bold tracking-tight mb-2">
                            Welcome to Stormglass
                        </h1>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
                            Stormglass tracks how weather and environmental conditions affect your health.
                            Select the conditions that apply to you — you can always change these in Settings.
                        </p>
                    </div>

                    {/* Select all / clear */}
                    <div className="flex items-center justify-between mb-5">
                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                            Which conditions affect you?
                        </span>
                        <div className="flex gap-3">
                            <button
                                onClick={selectAll}
                                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Select all
                            </button>
                            <span className="text-gray-600">·</span>
                            <button
                                onClick={clearAll}
                                className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Groups */}
                    <div className="space-y-5">
                        {GROUPS.map(group => (
                            <div key={group.heading}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-2 px-1">
                                    {group.heading}
                                </p>
                                <div className="bg-[#131d2e] border border-[#1e2d45] rounded-xl overflow-hidden">
                                    {group.conditions.map((cond, i) => {
                                        const isOn = selected.has(cond.key);
                                        return (
                                            <button
                                                key={cond.key}
                                                type="button"
                                                onClick={() => toggle(cond.key)}
                                                className={`
                                                    w-full flex items-center gap-3 px-4 py-3 text-left
                                                    transition-colors duration-150
                                                    ${i > 0 ? 'border-t border-[#1e2d45]' : ''}
                                                    ${isOn ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-white/3'}
                                                `}
                                            >
                                                {/* Checkbox */}
                                                <span className={`
                                                    flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150
                                                    ${isOn ? 'border-blue-500/50 bg-blue-500/20 text-blue-300' : 'border-[#2e3d55] bg-[#0f172a]'}
                                                `}>
                                                    {isOn && (
                                                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </span>

                                                {/* Label + hint */}
                                                <span className="flex-1 min-w-0">
                                                    <span className={`text-sm font-medium block ${isOn ? 'text-white' : 'text-gray-300'}`}>
                                                        {cond.label}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono">
                                                        {cond.hint}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 flex flex-col items-center gap-3">
                        <button
                            onClick={handleComplete}
                            disabled={selected.size === 0}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
                                bg-blue-600 hover:bg-blue-500 text-white
                                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                        >
                            {selected.size === 0
                                ? 'Select at least one condition'
                                : `Get Started with ${selected.size} condition${selected.size === 1 ? '' : 's'}`}
                        </button>
                        <button
                            onClick={() => {
                                selectAll();
                                // brief delay so state updates before completing
                                setTimeout(() => {
                                    const toggles = Object.fromEntries(ALL_KEYS.map(k => [k, true])) as HealthToggles;
                                    onComplete(toggles);
                                }, 0);
                            }}
                            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Enable everything and decide later
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
