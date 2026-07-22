export type SmokeTrendDirection = 'worsening' | 'improving' | 'stable';

export interface SmokeTrendRow {
    timestamp: Date;
    pm25: number;
    pm10: number;
    no2: number;
    so2: number;
    usAqi: number;
}

export interface SmokeTrend {
    direction: SmokeTrendDirection;
    currentPm25: number;
    next24hPeakPm25: number;
    next24hPeakUsAqi: number;
    next24hPeakAt: Date | null;
    likelyWildfireSmoke: boolean;
}

// Wildfire smoke is almost pure particulate with little of the gaseous pollution
// (NO2/SO2) that comes from traffic/industrial sources, so a PM2.5-dominant profile
// (PM2.5/PM10 close to 1, NO2 and SO2 low) is a useful "likely smoke" signal -- not
// a certainty, hence "likely" rather than an assertion in any UI copy that uses this.
const SMOKE_PM_RATIO_MIN = 0.65;
const SMOKE_NO2_MAX_PPB = 15;
const SMOKE_SO2_MAX_PPB = 5;
const SMOKE_PM25_MIN = 20;

// Below this delta, hour-to-hour PM2.5 noise shouldn't be read as a real trend.
const TREND_NOISE_FLOOR_UGM3 = 3;

export function analyzeSmokeTrend(
    pastRows: SmokeTrendRow[],
    futureRows: SmokeTrendRow[]
): SmokeTrend | null {
    if (pastRows.length === 0) return null;

    const current = pastRows[pastRows.length - 1];

    // Compare current reading against ~6h ago (or the earliest available) to judge
    // short-term direction without over-reacting to single-hour noise.
    const lookback = pastRows[Math.max(0, pastRows.length - 7)];
    const delta = current.pm25 - lookback.pm25;

    let direction: SmokeTrendDirection = 'stable';
    if (delta > TREND_NOISE_FLOOR_UGM3) direction = 'worsening';
    else if (delta < -TREND_NOISE_FLOOR_UGM3) direction = 'improving';

    let peakPm25 = current.pm25;
    let peakUsAqi = current.usAqi;
    let peakAt: Date | null = null;
    for (const row of futureRows) {
        if (row.pm25 > peakPm25) {
            peakPm25 = row.pm25;
            peakUsAqi = row.usAqi;
            peakAt = row.timestamp;
        }
    }

    const pmRatio = current.pm10 > 0 ? current.pm25 / current.pm10 : 0;
    const likelyWildfireSmoke =
        current.pm25 >= SMOKE_PM25_MIN &&
        pmRatio >= SMOKE_PM_RATIO_MIN &&
        current.no2 <= SMOKE_NO2_MAX_PPB &&
        current.so2 <= SMOKE_SO2_MAX_PPB;

    return {
        direction,
        currentPm25: current.pm25,
        next24hPeakPm25: Math.round(peakPm25 * 10) / 10,
        next24hPeakUsAqi: Math.round(peakUsAqi),
        next24hPeakAt: peakAt,
        likelyWildfireSmoke,
    };
}
