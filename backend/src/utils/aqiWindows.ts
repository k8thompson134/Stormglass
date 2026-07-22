export interface AQIWindowPoint {
    timestamp: Date;
    usAqi: number;
}

export interface SafeWindow {
    start: Date;
    end: Date;
    durationHours: number;
    avgAqi: number;
    maxAqi: number;
    isCurrent: boolean;
}

// A single stray hour above threshold inside an otherwise clear stretch shouldn't
// fragment "clear 2pm-10pm" into two separate windows -- tolerate brief spikes up to
// this many consecutive hours before treating the window as actually broken.
const DEFAULT_GAP_TOLERANCE_HOURS = 1;

/**
 * Scans a chronologically-sorted AQI series for contiguous stretches at or below
 * `threshold`, answering "when is it safe to go outside, and for how long" rather
 * than just reporting the current reading. Windows overlapping `now` are marked
 * `isCurrent`. Assumes roughly hourly-spaced points (as produced by the
 * airQualityData poll); duration is computed from actual timestamp deltas rather
 * than assuming a fixed spacing, so gaps in the underlying data degrade gracefully
 * (they just don't count toward window duration) rather than throwing.
 */
export function findSafeWindows(
    series: AQIWindowPoint[],
    threshold: number,
    now: Date,
    gapToleranceHours: number = DEFAULT_GAP_TOLERANCE_HOURS
): SafeWindow[] {
    if (series.length === 0) return [];

    const sorted = [...series].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const windows: SafeWindow[] = [];
    let groupStart: number | null = null; // index of first point in current group
    let groupEnd: number | null = null;   // index of last point at-or-below threshold
    let aboveStreakHours = 0;

    const flush = () => {
        if (groupStart === null || groupEnd === null) return;
        const startPt = sorted[groupStart];
        const endPt = sorted[groupEnd];
        const fullSpan = sorted.slice(groupStart, groupEnd + 1);
        const safePoints = fullSpan.filter(p => p.usAqi <= threshold);
        // avgAqi reflects the typical (safe) reading; maxAqi is taken from the whole
        // span so a tolerated brief spike still shows up honestly rather than being
        // averaged away.
        const avgAqi = safePoints.reduce((s, p) => s + p.usAqi, 0) / safePoints.length;
        const maxAqi = Math.max(...fullSpan.map(p => p.usAqi));
        const durationHours = (endPt.timestamp.getTime() - startPt.timestamp.getTime()) / 3_600_000;
        const isCurrent = startPt.timestamp <= now && now <= endPt.timestamp;
        windows.push({
            start: startPt.timestamp,
            end: endPt.timestamp,
            durationHours: Math.round(durationHours * 10) / 10,
            avgAqi: Math.round(avgAqi),
            maxAqi: Math.round(maxAqi),
            isCurrent,
        });
        groupStart = null;
        groupEnd = null;
        aboveStreakHours = 0;
    };

    for (let i = 0; i < sorted.length; i++) {
        const point = sorted[i];
        if (point.usAqi <= threshold) {
            if (groupStart === null) groupStart = i;
            groupEnd = i;
            aboveStreakHours = 0;
        } else if (groupStart !== null) {
            // Estimate the gap this point represents using the delta to the previous
            // sample rather than assuming exactly 1h spacing.
            const prevTs = sorted[i - 1]?.timestamp ?? point.timestamp;
            const gapHours = (point.timestamp.getTime() - prevTs.getTime()) / 3_600_000;
            aboveStreakHours += Math.max(gapHours, 0.1);
            if (aboveStreakHours > gapToleranceHours) {
                flush();
            }
            // else: tolerate the spike, keep the group open without extending groupEnd
            // past the last below-threshold point.
        }
    }
    flush();

    return windows;
}

export function nextSafeWindow(windows: SafeWindow[], now: Date): SafeWindow | null {
    const current = windows.find(w => w.isCurrent);
    if (current) return current;
    const upcoming = windows.filter(w => w.start.getTime() > now.getTime());
    if (upcoming.length === 0) return null;
    return upcoming.reduce((soonest, w) => w.start < soonest.start ? w : soonest, upcoming[0]);
}

// Mirrors the category boundaries used in getAQIRisk's own aqiCategory ternary --
// keep in sync if either changes.
export type AqiCategory = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy';
const CATEGORY_ORDER: AqiCategory[] = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy'];

export function classifyAqiCategory(usAqi: number): AqiCategory {
    if (usAqi >= 200) return 'Very Unhealthy';
    if (usAqi >= 150) return 'Unhealthy';
    if (usAqi >= 100) return 'Unhealthy for Sensitive Groups';
    if (usAqi >= 51) return 'Moderate';
    return 'Good';
}

export interface CategoryCrossing {
    fromCategory: AqiCategory;
    toCategory: AqiCategory;
    at: Date;
    usAqi: number;
}

/**
 * Finds the next time the forecast crosses into a WORSE AQI category than right now
 * -- e.g. "crosses into Unhealthy around 4pm" -- so checking manually during a
 * slow-building smoke event isn't something you have to remember to do. Only reports
 * a worsening crossing (never an improving one); returns null if the forecast never
 * gets worse than the current category within the rows provided.
 */
export function findNextCategoryCrossing(
    currentAqi: number,
    futureRows: AQIWindowPoint[],
    now: Date
): CategoryCrossing | null {
    const currentCategory = classifyAqiCategory(currentAqi);
    const currentIdx = CATEGORY_ORDER.indexOf(currentCategory);

    const sorted = [...futureRows]
        .filter(r => r.timestamp > now)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (const row of sorted) {
        const category = classifyAqiCategory(row.usAqi);
        const idx = CATEGORY_ORDER.indexOf(category);
        if (idx > currentIdx) {
            return { fromCategory: currentCategory, toCategory: category, at: row.timestamp, usAqi: row.usAqi };
        }
    }
    return null;
}
