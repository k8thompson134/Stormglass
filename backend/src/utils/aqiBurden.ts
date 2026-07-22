export interface AqiBurdenPoint {
    timestamp: Date;
    usAqi: number;
}

export interface DailyMax {
    date: string; // YYYY-MM-DD, in the caller's timeZone
    maxAqi: number;
}

export interface AqiBurdenSummary {
    totalDaysTracked: number;
    daysAtOrAboveThreshold: number;
    dailyMax: DailyMax[];
}

// en-CA formats as YYYY-MM-DD, conveniently matching the ISO date shape we want
// without hand-rolling zero-padding. Falls back to UTC on an invalid/unrecognized
// IANA zone name rather than throwing -- a malformed users.timezone value shouldn't
// break the whole summary.
function localDateKey(date: Date, timeZone: string): string {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

/**
 * Groups readings by calendar day in `timeZone` (the user's saved timezone; defaults
 * to UTC if not provided/invalid) and counts how many days had a peak AQI at or above
 * `threshold` -- "how much of this stretch has actually been bad, cumulatively"
 * rather than requiring you to remember day to day.
 */
export function summarizeAqiBurden(rows: AqiBurdenPoint[], threshold: number, timeZone: string = 'UTC'): AqiBurdenSummary {
    const byDay = new Map<string, number>();
    for (const row of rows) {
        const day = localDateKey(row.timestamp, timeZone);
        byDay.set(day, Math.max(byDay.get(day) ?? -Infinity, row.usAqi));
    }

    const dailyMax = [...byDay.entries()]
        .map(([date, maxAqi]) => ({ date, maxAqi: Math.round(maxAqi) }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        totalDaysTracked: dailyMax.length,
        daysAtOrAboveThreshold: dailyMax.filter(d => d.maxAqi >= threshold).length,
        dailyMax,
    };
}
