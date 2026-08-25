import {
  classifyPressureRate,
  computeEventSeverity,
  type EnvSeverity,
} from "./severity";

export interface PressureDataPoint {
  timestamp: string;
  pressureNum: number;
  delta1h: number | null;
}

export interface VolatileZone {
  start: string;
  end: string;
  severity: EnvSeverity;
  pressureChange: number;
  score: number;
}

const MAX_EVENT_HOURS = 18;
const MAX_GAP_POINTS = 2;

// A run of "significant pressure rate" points widened to the peak reading's
// surrounding +/-9h window (clipped to real sample timestamps, never a value that
// doesn't correspond to an actual axis category -- Recharts' ReferenceArea x1/x2
// must coincide with a real category on the categorical X axis or it silently fails
// to render), then scored as a single event rather than shown as raw per-point noise.
function finalizeZone(
  validData: PressureDataPoint[],
  avgPressure: number,
  zoneStartIdx: number | null,
  zoneEndIdx: number | null,
  peakIdx: number | null,
): VolatileZone | null {
  if (
    zoneStartIdx === null ||
    zoneEndIdx === null ||
    zoneEndIdx <= zoneStartIdx
  )
    return null;

  const baseStartIdx = zoneStartIdx;
  const baseEndIdx = zoneEndIdx;
  const startBase = validData[baseStartIdx];
  const endBase = validData[baseEndIdx];
  if (!startBase || !endBase) return null;

  const effectivePeakIdx =
    peakIdx !== null ? peakIdx : Math.floor((baseStartIdx + baseEndIdx) / 2);
  const peakPoint = validData[effectivePeakIdx];
  if (!peakPoint) return null;

  const peakMs = new Date(peakPoint.timestamp).getTime();
  const baseStartMs = new Date(startBase.timestamp).getTime();
  const baseEndMs = new Date(endBase.timestamp).getTime();
  if (
    Number.isNaN(peakMs) ||
    Number.isNaN(baseStartMs) ||
    Number.isNaN(baseEndMs)
  )
    return null;

  const halfWindowMs = (MAX_EVENT_HOURS / 2) * 3600000;
  const targetStartMs = Math.max(baseStartMs, peakMs - halfWindowMs);
  const targetEndMs = Math.min(baseEndMs, peakMs + halfWindowMs);
  if (targetEndMs <= targetStartMs) return null;

  let clippedStartIdx = baseStartIdx;
  for (let i = baseStartIdx; i <= baseEndIdx; i++) {
    const t = new Date(validData[i].timestamp).getTime();
    if (!Number.isNaN(t) && t >= targetStartMs) {
      clippedStartIdx = i;
      break;
    }
  }

  let clippedEndIdx = baseEndIdx;
  for (let i = baseEndIdx; i >= baseStartIdx; i--) {
    const t = new Date(validData[i].timestamp).getTime();
    if (!Number.isNaN(t) && t <= targetEndMs) {
      clippedEndIdx = i;
      break;
    }
  }
  if (clippedEndIdx <= clippedStartIdx) return null;

  let localMaxAbsDelta = 0;
  let localMinP = Infinity;
  let localMaxP = -Infinity;
  for (let i = clippedStartIdx; i <= clippedEndIdx; i++) {
    const d = validData[i];
    const absDelta = Math.abs(d.delta1h ?? 0);
    if (absDelta > localMaxAbsDelta) localMaxAbsDelta = absDelta;
    if (d.pressureNum < localMinP) localMinP = d.pressureNum;
    if (d.pressureNum > localMaxP) localMaxP = d.pressureNum;
  }

  const startTs = new Date(validData[clippedStartIdx].timestamp).getTime();
  const endTs = new Date(validData[clippedEndIdx].timestamp).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs <= startTs)
    return null;

  const durationHours = Math.max(1, (endTs - startTs) / 3600000);
  const swing = Math.abs(localMaxP - localMinP);
  const lowBelowBaseline = Math.max(0, avgPressure - localMinP);

  const { score, severity: eventSeverity } = computeEventSeverity({
    maxRate: localMaxAbsDelta,
    swing,
    durationHours,
    lowBelowBaseline,
  });

  // Filter out low-intensity events so only meaningful swings appear
  if (eventSeverity === "low") return null;

  return {
    start: validData[clippedStartIdx].timestamp,
    end: validData[clippedEndIdx].timestamp,
    severity: eventSeverity,
    pressureChange:
      validData[clippedEndIdx].pressureNum -
      validData[clippedStartIdx].pressureNum,
    score,
  };
}

/**
 * Scans a pressure time series for volatile stretches (sustained significant
 * pressure-rate-of-change) and scores each as a single weather event. avgPressure
 * is the mean over whatever range validData spans -- callers passing different
 * time ranges (24h vs 7d) will get different baselines and thus different event
 * severity for the same underlying storm.
 */
export function detectPressureEvents(
  validData: PressureDataPoint[],
  avgPressure: number,
): VolatileZone[] {
  const zones: VolatileZone[] = [];

  let zoneStartIdx: number | null = null;
  let peakIdx: number | null = null;
  let gapCount = 0;

  for (let i = 0; i < validData.length; i++) {
    const absDelta = Math.abs(validData[i].delta1h ?? 0);
    const sev = classifyPressureRate(absDelta);
    if (sev && sev !== "low") {
      gapCount = 0;
      if (zoneStartIdx === null) {
        zoneStartIdx = i;
        peakIdx = i;
      } else if (
        peakIdx === null ||
        absDelta > Math.abs(validData[peakIdx].delta1h ?? 0)
      ) {
        peakIdx = i;
      }
    } else if (zoneStartIdx !== null) {
      gapCount++;
      if (gapCount > MAX_GAP_POINTS) {
        const endIdx = i - 1;
        const zone = finalizeZone(
          validData,
          avgPressure,
          zoneStartIdx,
          endIdx >= zoneStartIdx ? endIdx : zoneStartIdx,
          peakIdx,
        );
        if (zone) zones.push(zone);
        zoneStartIdx = null;
        peakIdx = null;
        gapCount = 0;
      }
    }
  }

  if (zoneStartIdx !== null) {
    const endIdx = validData.length - 1;
    const zone = finalizeZone(
      validData,
      avgPressure,
      zoneStartIdx,
      endIdx,
      peakIdx,
    );
    if (zone) zones.push(zone);
  }

  return zones;
}

/**
 * Trims/drops zones to the visible past-only range when the forecast toggle is
 * off -- kept separate from detectPressureEvents so the detector stays purely
 * about "did a volatile event happen," with no awareness of a UI display toggle.
 */
export function clampZonesToVisibleRange(
  zones: VolatileZone[],
  opts: {
    showForecast: boolean;
    hours: number;
    lastPastTimestamp: string | null;
  },
): VolatileZone[] {
  const { showForecast, hours, lastPastTimestamp } = opts;
  if (showForecast || hours <= 6) return zones;

  return zones
    .map((zone) => {
      // If we don't know the last past sample, fall back to original behavior
      if (!lastPastTimestamp) return zone;

      const zoneEndMs = new Date(zone.end).getTime();
      const lastPastMs = new Date(lastPastTimestamp).getTime();

      // Cap the event end at the last real past data point so x2
      // always matches an existing category on the X axis.
      const cappedEnd = zoneEndMs > lastPastMs ? lastPastTimestamp : zone.end;

      return { ...zone, end: cappedEnd };
    })
    .filter(
      (zone) => new Date(zone.start).getTime() <= new Date(zone.end).getTime(),
    );
}
