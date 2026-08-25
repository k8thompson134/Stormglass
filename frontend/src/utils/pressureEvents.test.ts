import { describe, it, expect } from "vitest";
import {
  detectPressureEvents,
  clampZonesToVisibleRange,
  type PressureDataPoint,
} from "./pressureEvents";

// Hourly points starting at this timestamp, with pressureNum descending then
// recovering (a storm front) and delta1h reflecting the hour-over-hour change.
function makePoint(
  hourOffset: number,
  pressureNum: number,
  delta1h: number | null,
): PressureDataPoint {
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  return {
    timestamp: new Date(base + hourOffset * 3600000).toISOString(),
    pressureNum,
    delta1h,
  };
}

describe("detectPressureEvents", () => {
  it("returns no zones for a flat, stable series", () => {
    const data = Array.from({ length: 10 }, (_, i) => makePoint(i, 1013, 0.05));
    expect(detectPressureEvents(data, 1013)).toEqual([]);
  });

  it("detects a sustained volatile stretch as a single scored event", () => {
    const data = [
      makePoint(0, 1013, 0.05),
      makePoint(1, 1013, 0.05),
      // Sharp sustained drop -- 6 hours of severe rate-of-change
      makePoint(2, 1011, -1.5),
      makePoint(3, 1008, -1.6),
      makePoint(4, 1005, -1.5),
      makePoint(5, 1004, -1.2),
      makePoint(6, 1004.5, 1.1),
      makePoint(7, 1006, 1.3),
      makePoint(8, 1013, 0.05),
      makePoint(9, 1013, 0.05),
    ];
    const avgPressure = 1013;
    const zones = detectPressureEvents(data, avgPressure);

    expect(zones.length).toBe(1);
    expect(zones[0].severity).not.toBe("low");
    expect(Math.abs(zones[0].pressureChange)).toBeGreaterThan(0);
  });

  it("filters out a brief low-intensity blip", () => {
    const data = [
      makePoint(0, 1013, 0.05),
      // Single point just over the "moderate" rate threshold, no real swing --
      // shouldn't survive computeEventSeverity's low-severity cutoff.
      makePoint(1, 1012.8, 0.25),
      makePoint(2, 1013, 0.05),
      makePoint(3, 1013, 0.05),
    ];
    expect(detectPressureEvents(data, 1013)).toEqual([]);
  });

  it("scores the same storm shape differently against a different baseline", () => {
    // detectPressureEvents is deliberately baseline-sensitive by design -- the
    // caller decides what "baseline" means. This used to be a bug (task 406):
    // PressureChart passed its own range-scoped average, so the same storm
    // scored differently at 6h vs 7d. Fixed by having the caller pass a fixed
    // 7-day trailing baseline instead (see PressureChart.tsx's baselinePressure
    // prop) -- this test now documents that the function itself still needs a
    // stable baseline supplied to it, not that the dependency is unresolved.
    const data = [
      makePoint(0, 1013, 0.05),
      makePoint(1, 1013, 0.05),
      makePoint(2, 1008, -1.5),
      makePoint(3, 1004, -1.6),
      makePoint(4, 1003, -1.2),
      makePoint(5, 1004, 1.1),
      makePoint(6, 1008, 1.3),
      makePoint(7, 1013, 0.05),
    ];
    const zonesHighBaseline = detectPressureEvents(data, 1020);
    const zonesLowBaseline = detectPressureEvents(data, 1005);

    expect(zonesHighBaseline[0].score).toBeGreaterThan(
      zonesLowBaseline[0].score,
    );
  });
});

describe("clampZonesToVisibleRange", () => {
  const zone = {
    start: "2026-01-01T02:00:00.000Z",
    end: "2026-01-01T08:00:00.000Z",
    severity: "high" as const,
    pressureChange: -8,
    score: 70,
  };

  it("passes zones through unchanged when the forecast toggle is on", () => {
    const result = clampZonesToVisibleRange([zone], {
      showForecast: true,
      hours: 168,
      lastPastTimestamp: "2026-01-01T05:00:00.000Z",
    });
    expect(result).toEqual([zone]);
  });

  it("passes zones through unchanged on the 6h scale regardless of forecast toggle", () => {
    const result = clampZonesToVisibleRange([zone], {
      showForecast: false,
      hours: 6,
      lastPastTimestamp: "2026-01-01T05:00:00.000Z",
    });
    expect(result).toEqual([zone]);
  });

  it("caps a zone's end at the last past timestamp when forecast is off", () => {
    const result = clampZonesToVisibleRange([zone], {
      showForecast: false,
      hours: 24,
      lastPastTimestamp: "2026-01-01T05:00:00.000Z",
    });
    expect(result).toEqual([{ ...zone, end: "2026-01-01T05:00:00.000Z" }]);
  });

  it("drops a zone that starts entirely after the last past timestamp", () => {
    const futureZone = {
      ...zone,
      start: "2026-01-01T09:00:00.000Z",
      end: "2026-01-01T10:00:00.000Z",
    };
    const result = clampZonesToVisibleRange([futureZone], {
      showForecast: false,
      hours: 24,
      lastPastTimestamp: "2026-01-01T05:00:00.000Z",
    });
    expect(result).toEqual([]);
  });
});
