import { useState, useEffect, useRef } from 'react';
import { fetchSettings, updateLocation, geocodeSearch, type GeoResult } from '../services/api';

interface SettingsProps {
    open: boolean;
    onClose: () => void;
    onLocationChanged: () => void;
}

export default function Settings({ open, onClose, onLocationChanged }: SettingsProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [currentLat, setCurrentLat] = useState('');
    const [currentLon, setCurrentLon] = useState('');
    const [currentName, setCurrentName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus trap
    useEffect(() => {
        if (!open) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const timer = setTimeout(() => modalRef.current?.focus(), 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !modalRef.current) return;

            const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        };
    }, [open]);

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
        if (query.length < 2) {
            setResults([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await geocodeSearch(query);
                setResults(res);
            } catch {
                setResults([]);
            }
            setSearching(false);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    // Close on click outside
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open, onClose]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    const selectLocation = async (result: GeoResult) => {
        setSaving(true);
        setSaved(false);
        try {
            const formattedName = `${result.name}${result.state ? `, ${result.state}` : ''}`;
            await updateLocation(String(result.latitude), String(result.longitude), formattedName);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
                tabIndex={-1}
                className="relative w-full max-w-lg mx-4 bg-[#131d2e] border border-[#1e2d45] rounded-2xl shadow-2xl overflow-hidden outline-none"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#1e2d45]">
                    <h2 className="text-white text-sm font-bold uppercase tracking-wider">Settings</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        className="text-gray-500 hover:text-white transition-colors text-lg leading-none w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg"
                    >
                        ×
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Current Location */}
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2">
                            Current Location
                        </label>
                        <div className="bg-[#0f172a] rounded-xl p-4 border border-[#1e2d45]">
                            {currentName ? (
                                <div className="text-white text-sm font-semibold">{currentName}</div>
                            ) : (
                                <div className="text-gray-400 text-sm font-mono">
                                    {currentLat}, {currentLon}
                                </div>
                            )}
                            <div className="text-[10px] text-gray-600 font-mono mt-1">
                                {currentLat}°N, {currentLon}°W
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div>
                        <label
                            htmlFor="location-search"
                            className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2"
                        >
                            Change Location
                        </label>
                        <div className="relative">
                            <input
                                id="location-search"
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search city or location..."
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
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                            {r.state ? `${r.state}, ` : ''}{r.country}
                                            <span className="text-gray-700 ml-2 font-mono">
                                                {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {query.length >= 2 && !searching && results.length === 0 && (
                            <div className="mt-2 text-gray-600 text-xs px-1">No results found</div>
                        )}
                    </div>

                    {/* Status */}
                    <div aria-live="polite">
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

                {/* Footer */}
                <div className="px-5 py-3 border-t border-[#1e2d45] flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-xs text-gray-500 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
