import { useState, useRef } from 'react';
import { createSymptomLog } from '../services/api';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { HealthToggles } from '../types/health';

interface SymptomLoggerProps {
    open: boolean;
    onClose: () => void;
    onLogged: () => void;
    selectedConditions: HealthToggles;
}

const CONDITION_LABELS: Record<keyof HealthToggles, string> = {
    migraine: 'Migraines',
    cluster: 'Cluster Headache',
    pots: 'POTS / Dysautonomia',
    mecfs: 'ME/CFS',
    fibromyalgia: 'Fibromyalgia',
    joints: 'Joint Pain',
    eds: 'EDS',
    raynauds: "Raynaud's",
    sinus: 'Sinus',
    sleep: 'Sleep Quality',
    aqi: 'Air Quality',
    geomagnetic: 'Geomagnetic',
    pollen: 'Pollen',
};

const SEVERITY_COLORS: Record<number, string> = {
    1: 'bg-emerald-500',
    2: 'bg-emerald-400',
    3: 'bg-green-400',
    4: 'bg-yellow-400',
    5: 'bg-yellow-500',
    6: 'bg-amber-500',
    7: 'bg-orange-500',
    8: 'bg-red-400',
    9: 'bg-red-500',
    10: 'bg-red-600',
};

export default function SymptomLogger({ open, onClose, onLogged, selectedConditions }: SymptomLoggerProps) {
    const [severity, setSeverity] = useState(5);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTag, setCustomTag] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(open, modalRef, { onEscape: onClose });

    const presetTags = (Object.entries(selectedConditions)
        .filter(([, isSelected]) => isSelected)
        .map(([key]) => CONDITION_LABELS[key as keyof HealthToggles]));

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const addCustomTag = () => {
        const trimmed = customTag.trim();
        if (trimmed && !selectedTags.includes(trimmed)) {
            setSelectedTags(prev => [...prev, trimmed]);
        }
        setCustomTag('');
    };

    const handleSubmit = async () => {
        if (selectedTags.length === 0) {
            setError('Select at least one symptom tag');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await createSymptomLog({
                severity,
                tags: selectedTags,
                notes: notes.trim() || undefined,
            });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setSeverity(5);
                setSelectedTags([]);
                setCustomTag('');
                setNotes('');
                onLogged();
                onClose();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to log symptom');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 sm:py-10">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Log symptom"
                tabIndex={-1}
                className="relative w-full max-w-md mx-4 bg-[#131d2e] border border-[#1e2d45] rounded-2xl shadow-2xl outline-none"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#1e2d45]">
                    <h2 className="text-white text-sm font-bold uppercase tracking-wider">Log Symptom</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close symptom logger"
                        className="text-gray-400 hover:text-white transition-colors text-lg leading-none w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg"
                    >
                        &times;
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Severity */}
                    <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                            Severity
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={severity}
                                onChange={e => setSeverity(Number(e.target.value))}
                                className="flex-1 accent-blue-500 h-2"
                            />
                            <span
                                className={`${SEVERITY_COLORS[severity]} text-white text-xs font-bold w-8 h-8 flex items-center justify-center rounded-lg`}
                            >
                                {severity}
                            </span>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-500 mt-1 px-0.5">
                            <span>Mild</span>
                            <span>Severe</span>
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                            Symptoms
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {presetTags.map(tag => {
                                const active = selectedTags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`
                                            px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200
                                            ${active
                                                ? 'border-blue-500/50 bg-blue-500/20 text-blue-300'
                                                : 'border-[#1e2d45] bg-[#0f172a] text-gray-400 hover:border-gray-600 hover:text-gray-300'
                                            }
                                        `}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                            {/* Show custom tags that aren't in preset list */}
                            {selectedTags
                                .filter(t => !presetTags.includes(t))
                                .map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/50 bg-blue-500/20 text-blue-300 transition-all duration-200"
                                    >
                                        {tag} &times;
                                    </button>
                                ))}
                        </div>
                        <div className="mt-2 flex gap-2">
                            <input
                                type="text"
                                value={customTag}
                                onChange={e => setCustomTag(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addCustomTag();
                                    }
                                }}
                                placeholder="Add any condition..."
                                className="flex-1 bg-[#0f172a] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                            />
                            <button
                                type="button"
                                onClick={addCustomTag}
                                disabled={!customTag.trim()}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1e2d45] bg-[#0f172a] text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-colors disabled:opacity-40"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                            Notes <span className="text-gray-500 normal-case">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Any additional context..."
                            className="w-full bg-[#0f172a] border border-[#1e2d45] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-xs text-red-400">{error}</p>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400" aria-live="polite">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Symptom logged with environmental snapshot
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || success}
                        className="w-full py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Logging...' : 'Log Symptom'}
                    </button>
                </div>
            </div>
        </div>
    );
}
