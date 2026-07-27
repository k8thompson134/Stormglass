import { useState, useEffect, useRef } from 'react';
import { fetchSettings, updateLocation, geocodeSearch, type GeoResult } from '../services/api';
import type { HealthToggles, HealthConditionKey } from '../types/health';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { AQI_SENSITIVITY_OPTIONS, type AqiSensitivity } from '../utils/aqiCategory';

interface SettingsProps {
    open: boolean;
    onClose: () => void;
    onLocationChanged: () => void;
    healthToggles: HealthToggles;
    onHealthTogglesChange: (toggles: HealthToggles) => void;
    aqiSensitivity: AqiSensitivity;
    onAqiSensitivityChange: (sensitivity: AqiSensitivity) => void;
}

export default function Settings({ open, onClose, onLocationChanged, healthToggles, onHealthTogglesChange, aqiSensitivity, onAqiSensitivityChange }: SettingsProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [currentLat, setCurrentLat] = useState('');
    const [currentLon, setCurrentLon] = useState('');
    const [currentName, setCurrentName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [tokenRevealed, setTokenRevealed] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestQueryRef = useRef('');
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(open, modalRef, { onEscape: onClose });

    const apiToken = import.meta.env.VITE_API_TOKEN as string | undefined;

    const copyToken = async () => {
        if (!apiToken) return;
        await navigator.clipboard.writeText(apiToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
    };

    // Load current settings
    useEffect(() => {
        if (open) {
            fetchSettings().then(s => {
                setCurrentLat(s.latitude);
                setCurrentLon(s.longitude);
                if (s.name) setCurrentName(s.name);
            }).catch((err) => {
                console.error('Failed to load settings:', err);
            });
        }
    }, [open]);

    // Debounced geocode search
    useEffect(() => {
        latestQueryRef.current = query;

        if (query.length < 2) {
            setResults([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await geocodeSearch(query);
                // A slower, now-superseded request can resolve after a newer
                // one -- only apply results if this effect run is still current.
                if (latestQueryRef.current !== query) return;
                setResults(res);
            } catch {
                if (latestQueryRef.current === query) setResults([]);
            }
            if (latestQueryRef.current === query) setSearching(false);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    // Close on click outside or Escape key
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    const selectLocation = async (result: GeoResult) => {
        setSaving(true);
        setSaved(false);
        try {
            const formattedName = `${result.name}${result.state ? `, ${result.state}` : ''}`;
            await updateLocation(String(result.latitude), String(result.longitude), formattedName, result.timezone ?? undefined);
            setCurrentLat(String(result.latitude));
            setCurrentLon(String(result.longitude));
            setCurrentName(`${formattedName}, ${result.country}`);
            setQuery('');
            setResults([]);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onLocationChanged();
        } catch (err) {
            console.error('Failed to update location:', err);
        }
        setSaving(false);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 sm:py-10">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
                tabIndex={-1}
                className="relative w-full max-w-lg mx-4 bg-[#131d2e] border border-[#1e2d45] rounded-2xl shadow-2xl outline-none max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#1e2d45]">
                    <h2 className="text-white text-sm font-bold uppercase tracking-wider">Settings</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        className="text-gray-300 hover:text-white transition-colors text-lg leading-none w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg"
                    >
                        ×
                    </button>
                </div>

                <div className="p-5 space-y-5 overflow-y-auto">
                    {/* Current Location */}
                    <div>
                        <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
                            Current Location
                        </label>
                        <div className="bg-[#0f172a] rounded-xl p-4 border border-[#1e2d45] space-y-1.5">
                            {currentName ? (
                                <div className="text-white text-sm font-semibold">{currentName}</div>
                            ) : (
                                <>
                                    <div className="text-gray-300 text-sm font-semibold">Default location</div>
                                    <p className="text-[11px] text-amber-300">
                                        Stormglass is using a built-in default location. Use{" "}
                                        <span className="font-semibold">Change Location</span> below to set your own.
                                    </p>
                                </>
                            )}
                            <div className="text-[10px] text-gray-500 font-mono">
                                {currentLat}°N, {currentLon}°W
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div>
                        <label
                            htmlFor="location-search"
                            className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2"
                        >
                            Change Location
                        </label>
                        <div className="relative">
                            <input
                                id="location-search"
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by city or ZIP code..."
                                className="w-full bg-[#0f172a] text-white text-sm rounded-xl px-4 py-3 border border-[#1e2d45] focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 placeholder-gray-600 transition-colors"
                            />
                            {searching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* Results dropdown */}
                        {results.length > 0 && (
                            <div className="mt-2 bg-[#0f172a] border border-[#1e2d45] rounded-xl overflow-hidden">
                                {results.map((r, i) => (
                                    <button
                                        key={i}
                                        onClick={() => selectLocation(r)}
                                        disabled={saving}
                                        className="w-full text-left px-4 py-3 hover:bg-blue-500/10 transition-colors border-b border-[#1e2d45] last:border-b-0 group disabled:opacity-50"
                                    >
                                        <div className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">
                                            {r.name}
                                        </div>
                                        <div className="text-[10px] text-gray-300 mt-0.5">
                                            {r.state ? `${r.state}, ` : ''}{r.country}
                                            <span className="text-gray-500 ml-2 font-mono">
                                                {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {query.length >= 2 && !searching && results.length === 0 && (
                            <div className="mt-2 text-gray-500 text-xs px-1">No results found</div>
                        )}

                        {/* Location save status -- shown right where the action happened,
                            not below the long health-factors list further down the modal. */}
                        <div aria-live="polite" className="mt-2">
                            {saved && (
                                <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                    <span>✓</span>
                                    <span>Location updated — fetching new data...</span>
                                </div>
                            )}

                            {saving && (
                                <div className="flex items-center gap-2 text-blue-400 text-xs bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                                    <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                    <span>Updating location...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Health factors */}
                    <div>
                        <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
                            Health Factors Shown
                        </label>
                        <p className="text-[11px] text-gray-300 mb-3">
                            Choose which conditions to show in the Health Impact Forecast.
                        </p>
                        <div className="bg-[#0f172a] rounded-xl border border-[#1e2d45] overflow-hidden">
                            {[
                                ['migraine', 'Migraines'],
                                ['cluster', 'Cluster Headache'],
                                ['sinus', 'Sinus / Sinusitis'],
                                ['pots', 'POTS / Dysautonomia'],
                                ['mecfs', 'ME/CFS / PEM'],
                                ['joints', 'Joint Pain (Arthritis)'],
                                ['fibromyalgia', 'Fibromyalgia'],
                                ['eds', 'EDS / Hypermobility'],
                                ['raynauds', "Raynaud's"],
                                ['sleep', 'Sleep Quality'],
                                ['aqi', 'Air Quality'],
                                ['geomagnetic', 'Geomagnetic Storms'],
                                ['pollen', 'Pollen & Mold'],
                            ].map(([key, label]) => {
                                const k = key as HealthConditionKey;
                                const isOn = healthToggles[k];
                                return (
                                    <label
                                        key={k}
                                        className={`
                                            flex items-center gap-3 cursor-pointer select-none
                                            px-4 py-3 border-b border-[#1e2d45] last:border-b-0
                                            transition-colors duration-200
                                            hover:bg-blue-500/5
                                            ${isOn ? 'bg-blue-500/10' : ''}
                                        `}
                                    >
                                        <span
                                            className={`
                                                flex h-4 w-4 shrink-0 items-center justify-center rounded border
                                                transition-colors duration-200
                                                ${isOn
                                                    ? 'border-blue-500/50 bg-blue-500/20 text-blue-300'
                                                    : 'border-[#1e2d45] bg-[#131d2e]'
                                                }
                                            `}
                                            aria-hidden
                                        >
                                            {isOn && (
                                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={isOn}
                                            onChange={e => onHealthTogglesChange({ ...healthToggles, [k]: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium text-gray-200">{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Air Quality Sensitivity */}
                    <div className="border-t border-[#1e2d45] pt-5">
                        <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
                            Air Quality Safety Threshold
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
                            <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
                                    healthToggles.aqi ? 'border-blue-500/50 bg-blue-500/20 text-blue-300' : 'border-[#1e2d45] bg-[#131d2e]'
                                }`}
                                aria-hidden
                            >
                                {healthToggles.aqi && (
                                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </span>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={healthToggles.aqi}
                                onChange={e => onHealthTogglesChange({ ...healthToggles, aqi: e.target.checked })}
                            />
                            <span className="text-[11px] text-gray-300">Track air quality</span>
                        </label>
                        {healthToggles.aqi && (
                            <>
                                <p className="text-[11px] text-gray-300 mb-3">
                                    The highest AQI category you consider safe. Used for the safe-window callout and chart shading.
                                </p>
                                <div className="flex bg-[#0f172a] rounded-xl border border-[#1e2d45] p-1 gap-1">
                                    {AQI_SENSITIVITY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.category}
                                            type="button"
                                            onClick={() => onAqiSensitivityChange(opt.category)}
                                            aria-pressed={aqiSensitivity === opt.category}
                                            title={`${opt.category} or better counts as "safe" (AQI ≤ ${opt.ceiling})`}
                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${aqiSensitivity === opt.category ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* API Access */}
                    <div className="border-t border-[#1e2d45] pt-5">
                        <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
                            API Access
                        </label>
                        <p className="text-[11px] text-gray-300 mb-3">
                            Use this token to connect OpenClaw or other apps to your Stormglass data.
                        </p>
                        {apiToken ? (
                            <div className="bg-[#0f172a] rounded-xl border border-[#1e2d45] p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-[11px] font-mono text-gray-300 truncate select-all">
                                        {tokenRevealed ? apiToken : `${apiToken.slice(0, 6)}${'•'.repeat(20)}${apiToken.slice(-4)}`}
                                    </code>
                                    <button
                                        onClick={() => setTokenRevealed(r => !r)}
                                        aria-label={tokenRevealed ? 'Hide token' : 'Reveal token'}
                                        className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded shrink-0"
                                    >
                                        {tokenRevealed ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        )}
                                    </button>
                                    <button
                                        onClick={copyToken}
                                        aria-label="Copy API token"
                                        className="text-gray-500 hover:text-blue-300 transition-colors p-1 rounded shrink-0"
                                    >
                                        {tokenCopied ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        )}
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500">
                                    Endpoint: <span className="font-mono text-gray-300">{window.location.origin}/api/briefing</span>
                                </p>
                            </div>
                        ) : (
                            <div className="bg-[#0f172a] rounded-xl border border-amber-500/20 p-3">
                                <p className="text-[11px] text-amber-300">
                                    No API token configured. Set <span className="font-mono">VITE_API_TOKEN</span> in your <span className="font-mono">.env</span> and rebuild.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Feedback */}
                    <div className="border-t border-[#1e2d45] pt-5">
                        <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
                            Help Us Improve
                        </label>
                        <a
                            href="https://forms.gle/zYUzyjHYSisnc7zJ9"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-blue-300 hover:text-blue-200 transition-colors text-sm font-medium"
                        >
                            <span>Send Feedback</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 7h10v10" />
                                <path d="M7 17L17 7" />
                            </svg>
                        </a>
                        <p className="text-[10px] text-gray-300 mt-2">Share your experience and help shape Stormglass</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-[#1e2d45] flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-xs text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
