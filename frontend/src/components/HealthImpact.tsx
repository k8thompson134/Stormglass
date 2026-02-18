import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CurrentWeather } from '../services/api';
import type { HealthRisk, RiskLevel } from '../types/health';
import {
    getMigraineRisk,
    getPOTSRisk,
    getMECFSRisk,
    getJointPainRisk,
    getAQIRisk,
    getGeomagneticRisk,
    getPollenRisk
} from '../utils/healthLogic';

interface Props {
    data: CurrentWeather | null;
    loading: boolean;
}

function RiskCard({ risk, onClick }: { risk: HealthRisk; onClick: () => void }) {
    const theme = {
        low: {
            card: 'bg-gray-800/30 hover:bg-gray-800/50 border-gray-700/40 hover:border-emerald-500/30',
            stripe: 'bg-emerald-500/50',
            title: 'text-gray-300',
            badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
            desc: 'text-gray-500',
            trigger: 'text-gray-600',
            detail: 'text-emerald-300',
            glow: 'hover:shadow-glow-emerald',
        },
        moderate: {
            card: 'bg-gray-800/30 hover:bg-amber-950/20 border-amber-500/25 hover:border-amber-500/45',
            stripe: 'bg-amber-500',
            title: 'text-gray-200',
            badge: 'bg-amber-500/20 text-amber-300 border-amber-500/35',
            desc: 'text-gray-400',
            trigger: 'text-gray-500',
            detail: 'text-amber-300',
            glow: 'hover:shadow-glow-amber',
        },
        high: {
            card: 'bg-gray-800/30 hover:bg-orange-950/25 border-orange-500/35 hover:border-orange-500/55',
            stripe: 'bg-orange-500',
            title: 'text-gray-100',
            badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
            desc: 'text-gray-300',
            trigger: 'text-gray-500',
            detail: 'text-orange-300',
            glow: 'hover:shadow-glow-red',
        },
        severe: {
            card: 'bg-gray-800/30 hover:bg-red-950/30 border-red-500/40 hover:border-red-500/65',
            stripe: 'bg-red-500',
            title: 'text-white',
            badge: 'bg-red-500/25 text-red-300 border-red-500/40',
            desc: 'text-gray-300',
            trigger: 'text-gray-400',
            detail: 'text-red-300',
            glow: 'hover:shadow-glow-red',
        },
    }[risk.risk];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                relative group cursor-pointer overflow-hidden rounded-xl border text-left
                transition-all duration-300 hover:-translate-y-0.5
                flex h-full ${theme.card} ${theme.glow}
            `}
        >
            {/* Left accent stripe */}
            <div className={`w-1 shrink-0 ${theme.stripe} transition-all duration-300 group-hover:w-1.5`} />

            {/* Card content */}
            <div className="flex-1 p-4 flex flex-col min-w-0">
                {/* Title + Risk Level */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className={`font-bold text-[11px] uppercase tracking-widest leading-tight ${theme.title}`}>
                        {risk.condition}
                    </h3>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${theme.badge}`}>
                        {risk.risk}
                    </span>
                </div>

                {/* Description */}
                <p className={`text-[10px] leading-relaxed line-clamp-2 flex-1 ${theme.desc}`}>
                    {risk.description}
                </p>

                {/* Footer */}
                <div className="mt-3 pt-2 border-t border-gray-700/20 flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase tracking-tight truncate max-w-[70%] ${theme.trigger}`}>
                        {risk.trigger}
                    </span>
                    <span className={`text-[10px] font-medium opacity-0 group-hover:opacity-80 transition-all duration-300 ${theme.detail}`}>
                        Details →
                    </span>
                </div>
            </div>
        </button>
    );
}

function DetailModal({ risk, onClose }: { risk: HealthRisk | null; onClose: () => void }) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus trap and keyboard handling
    useEffect(() => {
        if (!risk) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;

        // Focus the modal on open
        const timer = setTimeout(() => modalRef.current?.focus(), 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
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
    }, [risk, onClose]);

    if (!risk) return null;

    const theme = {
        low: { stripe: 'bg-emerald-500', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35', dot: 'bg-emerald-400', headerBg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
        moderate: { stripe: 'bg-amber-500', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/35', dot: 'bg-amber-400', headerBg: 'bg-amber-500/10', border: 'border-amber-500/30' },
        high: { stripe: 'bg-orange-500', text: 'text-orange-300', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/35', dot: 'bg-orange-400', headerBg: 'bg-orange-500/10', border: 'border-orange-500/30' },
        severe: { stripe: 'bg-red-500', text: 'text-red-300', badge: 'bg-red-500/25 text-red-300 border-red-500/40', dot: 'bg-red-400', headerBg: 'bg-red-500/15', border: 'border-red-500/35' },
    }[risk.risk];

    return createPortal(
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={`${risk.condition} risk details`}
                tabIndex={-1}
                className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col outline-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex ${theme.headerBg}`}>
                    <div className={`w-1.5 shrink-0 ${theme.stripe}`} />
                    <div className="flex-1 p-5 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">{risk.condition}</h2>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${theme.badge}`}>
                                    {risk.risk} risk
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono uppercase">Trigger: {risk.trigger}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center hover:bg-gray-800/50 rounded-lg"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="p-5 space-y-4 overflow-y-auto">
                    {/* Summary */}
                    <p className="text-gray-200 text-sm leading-relaxed">{risk.description}</p>

                    {/* Detailed Explanation */}
                    <div className="border-t border-gray-700/30 pt-4">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2">Why This Affects Symptoms</h3>
                        <p className="text-gray-300 text-[13px] leading-relaxed">{risk.detailedExplanation}</p>
                    </div>

                    {/* Two-column: Factors + Recommendations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-700/30 pt-4">
                        {/* Current Factors */}
                        <div>
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2.5">Current Factors</h3>
                            <ul className="space-y-2">
                                {risk.currentFactors.map((factor, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-gray-300">
                                        <span className={`w-1 h-1 rounded-full ${theme.dot} mt-1.5 shrink-0`} />
                                        <span className="text-[12px] leading-relaxed">{factor}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Recommendations */}
                        <div>
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2.5">Recommendations</h3>
                            <ul className="space-y-2">
                                {risk.recommendations.map((rec, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-gray-300">
                                        <span className={`text-[10px] leading-none mt-0.5 shrink-0 ${theme.text}`}>→</span>
                                        <span className="text-[12px] leading-relaxed">{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function HealthImpact({ data, loading }: Props) {
    const [selectedRisk, setSelectedRisk] = useState<HealthRisk | null>(null);

    if (loading) {
        return (
            <div className="bg-[#131d2e] rounded-2xl p-6 border border-[#1e2d45] animate-pulse">
                <div className="h-5 bg-gray-700/50 rounded w-48 mb-4" />
                <div className="h-16 bg-gray-700/30 rounded-xl mb-4" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-800/50 rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const d = data.derivative;
    const delta1h = d?.delta1h ?? 0;
    const delta3h = d?.delta3h ?? 0;
    const delta6h = d?.delta6h ?? 0;

    const risks = [
        getMigraineRisk(delta1h),
        getPOTSRisk(delta1h, data.humidity, data.temperature),
        getMECFSRisk(delta1h, delta3h, delta6h),
        getJointPainRisk(delta1h, data.humidity, data.temperature),
        getAQIRisk(data.aqi ?? null),
        getGeomagneticRisk(data.geomagnetic ?? null),
        getPollenRisk(data.pollen ?? null),
    ];

    // Sort by severity: severe > high > moderate > low
    const riskOrder: Record<RiskLevel, number> = { severe: 3, high: 2, moderate: 1, low: 0 };
    const sortedRisks = [...risks].sort((a, b) => riskOrder[b.risk] - riskOrder[a.risk]);
    const elevatedRisks = sortedRisks.filter(r => r.risk !== 'low');
    const highestRisk = sortedRisks[0];

    // Body Impact Summary config
    const summaryMap: Record<RiskLevel, { label: string; text: string; bar: string; gradient: string; chipBg: string; chipBorder: string; chipText: string }> = {
        severe: { label: 'High Impact', text: 'text-red-400', bar: 'bg-red-500', gradient: 'from-red-500/8 via-transparent to-transparent', chipBg: 'bg-red-500/15', chipBorder: 'border-red-500/30', chipText: 'text-red-300' },
        high: { label: 'Elevated Impact', text: 'text-orange-400', bar: 'bg-orange-500', gradient: 'from-orange-500/8 via-transparent to-transparent', chipBg: 'bg-orange-500/15', chipBorder: 'border-orange-500/30', chipText: 'text-orange-300' },
        moderate: { label: 'Moderate Impact', text: 'text-amber-400', bar: 'bg-amber-500', gradient: 'from-amber-500/8 via-transparent to-transparent', chipBg: 'bg-amber-500/15', chipBorder: 'border-amber-500/30', chipText: 'text-amber-300' },
        low: { label: 'All Clear', text: 'text-emerald-400', bar: 'bg-emerald-500', gradient: 'from-emerald-500/8 via-transparent to-transparent', chipBg: 'bg-emerald-500/15', chipBorder: 'border-emerald-500/30', chipText: 'text-emerald-300' },
    };
    const sc = summaryMap[highestRisk.risk];
    const severityIdx = riskOrder[highestRisk.risk]; // 0-3
    const summaryText = elevatedRisks.length === 0
        ? 'All environmental factors are within comfortable ranges. No weather-related symptom triggers detected.'
        : `${elevatedRisks.map(r => r.condition).join(', ')} ${elevatedRisks.length === 1 ? 'is' : 'are'} elevated due to current conditions. ${highestRisk.description}`;

    return (
        <div className="bg-[#131d2e] rounded-2xl p-4 sm:p-6 border border-[#1e2d45] shadow-xl">
            <h2 className="text-gray-400 text-xs font-medium tracking-wider uppercase mb-4">Health Impact Forecast</h2>

            {/* Body Impact Summary — Meter Bar Design */}
            <div className="relative overflow-hidden rounded-xl border border-gray-700/30 mb-6">
                <div className={`absolute inset-0 bg-gradient-to-r ${sc.gradient} pointer-events-none`} />

                <div className="relative p-5">
                    {/* Header + Label */}
                    <div className="flex items-baseline justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Body Impact Level</span>
                        <span className={`text-sm font-black tracking-tight ${sc.text}`}>{sc.label}</span>
                    </div>

                    {/* Severity Meter Bar */}
                    <div className="flex gap-1 mb-1.5">
                        {[0, 1, 2, 3].map(i => (
                            <div
                                key={i}
                                className={`h-2 flex-1 rounded-full transition-all duration-700 ${i <= severityIdx ? sc.bar : 'bg-gray-700/40'
                                    } ${i <= severityIdx ? 'opacity-100' : 'opacity-100'}`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-4">
                        <span>Low</span>
                        <span>Moderate</span>
                        <span>High</span>
                        <span>Severe</span>
                    </div>

                    {/* Summary text */}
                    <p className="text-[11px] text-gray-300/80 leading-relaxed">{summaryText}</p>

                    {/* Affected conditions chips */}
                    {elevatedRisks.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {elevatedRisks.map((r, i) => {
                                const chipColor = {
                                    low: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
                                    moderate: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
                                    high: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
                                    severe: 'bg-red-500/15 border-red-500/30 text-red-300',
                                }[r.risk];
                                return (
                                    <span key={i} className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${chipColor}`}>
                                        <span>{r.condition}</span>
                                        <span className="opacity-40">·</span>
                                        <span className="capitalize opacity-70">{r.risk}</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Risk Cards — Horizontal Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {sortedRisks.map((risk, i) => (
                    <RiskCard key={i} risk={risk} onClick={() => setSelectedRisk(risk)} />
                ))}
            </div>

            <DetailModal risk={selectedRisk} onClose={() => setSelectedRisk(null)} />
        </div>
    );
}
