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

// Single source of truth for the official EPA/AirNow US AQI category bands --
// getAQIRisk (backend) and aqiCategory.ts (frontend) both call into this rather
// than hand-copying the boundaries.
export type AqiCategory = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
export const CATEGORY_ORDER: AqiCategory[] = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];

// Lower bound (inclusive) of each category, per EPA's official breakpoints.
export const CATEGORY_FLOOR: Record<AqiCategory, number> = {
    'Good': 0,
    'Moderate': 51,
    'Unhealthy for Sensitive Groups': 101,
    'Unhealthy': 151,
    'Very Unhealthy': 201,
    'Hazardous': 301,
};

export function classifyAqiCategory(usAqi: number): AqiCategory {
    if (usAqi >= 301) return 'Hazardous';
    if (usAqi >= 201) return 'Very Unhealthy';
    if (usAqi >= 151) return 'Unhealthy';
    if (usAqi >= 101) return 'Unhealthy for Sensitive Groups';
    if (usAqi >= 51) return 'Moderate';
    return 'Good';
}

// Highest AQI still considered part of `category` -- e.g. the ceiling of 'Moderate'
// is 100 (one below the next category's floor). Used to turn a category name into
// a numeric "safe below this" threshold for findSafeWindows.
export function categoryCeiling(category: AqiCategory): number {
    const idx = CATEGORY_ORDER.indexOf(category);
    const next = CATEGORY_ORDER[idx + 1];
    return next ? CATEGORY_FLOOR[next] - 1 : 500;
}

// PurpleAir's dense sensor network catches localized smoke plumes that the
// ~11km-grid regional model can miss or lag; take the worse (higher) of the two
// readings so downstream risk/category logic errs toward protecting against smoke
// the model hasn't caught up to yet, rather than averaging it away.
export function effectiveAqi(modelAqi: number, hyperlocalAqi: number | null | undefined): number {
    return hyperlocalAqi != null ? Math.max(modelAqi, hyperlocalAqi) : modelAqi;
}

// Continuous 0-1 severity used to graduate AQI's influence on OTHER risk
// calculations (migraine, ME/CFS, POTS, joint pain) across all 6 EPA categories,
// rather than saturating at a single "unhealthy" cutoff -- a Hazardous day should
// weigh more heavily than a bare Unhealthy one, not identically. Coefficients here
// are a heuristic ladder, not derived from a specific study; keep escalation modest
// and monotonic rather than implying more precision than the evidence supports.
const SEVERITY_FACTOR: Record<AqiCategory, number> = {
    'Good': 0,
    'Moderate': 0.15,
    'Unhealthy for Sensitive Groups': 0.35,
    'Unhealthy': 0.6,
    'Very Unhealthy': 0.8,
    'Hazardous': 1,
};

export function aqiSeverityFactor(usAqi: number | null | undefined): number {
    if (usAqi == null) return 0;
    return SEVERITY_FACTOR[classifyAqiCategory(usAqi)];
}

// Graduated 0/1/2 contribution to an integer risk score (POTS, joint pain, etc.),
// escalating once air quality crosses into genuinely worse categories instead of a
// flat +1 for anything past a single "polluted" threshold.
export function aqiScoreBump(usAqi: number | null | undefined): 0 | 1 | 2 {
    if (usAqi == null) return 0;
    const category = classifyAqiCategory(usAqi);
    if (category === 'Very Unhealthy' || category === 'Hazardous') return 2;
    if (category === 'Unhealthy for Sensitive Groups' || category === 'Unhealthy') return 1;
    return 0;
}

/**
 * Finds the first future point where AQI drops back below `categoryIdxThreshold`
 * (a CATEGORY_ORDER index) after `after` -- lets a "worsening" alert also say when
 * it's expected to clear, not just when it starts. Returns null if nothing in the
 * provided points ever drops back down (the alert then has to say "at least into
 * tomorrow's forecast" rather than claim a specific end time it doesn't have).
 */
export function findCategoryClearTime(
    points: AQIWindowPoint[],
    after: Date,
    categoryIdxThreshold: number
): Date | null {
    const sorted = [...points]
        .filter(p => p.timestamp > after)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (const point of sorted) {
        const idx = CATEGORY_ORDER.indexOf(classifyAqiCategory(point.usAqi));
        if (idx < categoryIdxThreshold) return point.timestamp;
    }
    return null;
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
