import { describe, it, expect } from "vitest";
import {
  analyzeConditions,
  computeTodayRisk,
  computeProtectiveFactors,
} from "./symptomAnalysis";
import type { SymptomLogEntry, CurrentWeather } from "../services/api";

let nextId = 0;
function makeLog(
  severity: number,
  tags: string[],
  snapshot: Partial<SymptomLogEntry["environmentalSnapshot"]> | null,
): SymptomLogEntry {
  nextId += 1;
  return {
    id: `log-${nextId}`,
    userId: "u1",
    timestamp: new Date(2026, 0, nextId).toISOString(),
    severity,
    tags,
    notes: null,
    environmentalSnapshot: snapshot as SymptomLogEntry["environmentalSnapshot"],
  };
}

function makeCurrent(overrides: Partial<CurrentWeather>): CurrentWeather {
  return {
    timestamp: new Date().toISOString(),
    pressure: 1013,
    temperature: 20,
    humidity: 40,
    windSpeed: 2,
    windDirection: 180,
    uvIndex: 3,
    cloudCover: 20,
    precipitation: 0,
    dewPoint: 10,
    derivative: null,
    aqi: null,
    geomagnetic: null,
    pollen: null,
    ...overrides,
  };
}

describe("analyzeConditions", () => {
  // B3: `humidity ?? 0 > 85` parsed as `humidity ?? (0 > 85)`, so any snapshot
  // with humidity <= 85 was still flagged as a "High Humidity" trigger.
  it("does not flag a log with normal humidity as a humidity trigger", () => {
    const logs = [
      makeLog(5, ["migraine"], { humidity: 50 } as never),
      makeLog(6, ["migraine"], { humidity: 55 } as never),
    ];
    const [analysis] = analyzeConditions(logs);
    expect(analysis.triggers.find((t) => t.key === "humidity")).toBeUndefined();
  });

  it("flags a humidity trigger only when humidity is actually above 85", () => {
    const logs = [
      makeLog(8, ["migraine"], { humidity: 90 } as never),
      makeLog(2, ["migraine"], { humidity: 40 } as never),
    ];
    const [analysis] = analyzeConditions(logs);
    const trigger = analysis.triggers.find((t) => t.key === "humidity");
    expect(trigger).toBeDefined();
    expect(trigger?.severity).toBe(8);
  });

  // B16: `(pressure ?? 0) < 990` counted every log with NO snapshot as
  // "low pressure" because the default 0 satisfies "< 990".
  it("does not count a log with no environmental snapshot as low pressure", () => {
    const logs = [
      makeLog(5, ["migraine"], null),
      makeLog(6, ["migraine"], null),
    ];
    const [analysis] = analyzeConditions(logs);
    expect(analysis.triggers.find((t) => t.key === "pressure")).toBeUndefined();
  });

  it("flags a pressure trigger when pressure is actually below 990", () => {
    const logs = [
      makeLog(9, ["migraine"], { pressure: 980 } as never),
      makeLog(2, ["migraine"], { pressure: 1015 } as never),
    ];
    const [analysis] = analyzeConditions(logs);
    const trigger = analysis.triggers.find((t) => t.key === "pressure");
    expect(trigger).toBeDefined();
    expect(trigger?.severity).toBe(9);
  });
});

describe("computeTodayRisk", () => {
  it("returns no-current-data when current conditions are unavailable", () => {
    const logs = [makeLog(8, ["migraine"], { humidity: 90 } as never)];
    const [topCondition] = analyzeConditions(logs);
    expect(computeTodayRisk(topCondition, null)).toEqual({
      status: "no-current-data",
    });
  });

  // B13: the historical primary trigger used to be shown as "today's risk"
  // unconditionally, even when nothing like it was happening right now.
  it("returns clear when none of the condition's historical triggers are active right now", () => {
    const logs = [makeLog(8, ["migraine"], { humidity: 90 } as never)];
    const [topCondition] = analyzeConditions(logs);
    const current = makeCurrent({ humidity: 40 });
    expect(computeTodayRisk(topCondition, current)).toEqual({
      status: "clear",
      riskLevel: "low",
    });
  });

  it("returns active with the matching trigger when it IS happening right now", () => {
    const logs = [makeLog(8, ["migraine"], { humidity: 90 } as never)];
    const [topCondition] = analyzeConditions(logs);
    const current = makeCurrent({ humidity: 92 });
    const risk = computeTodayRisk(topCondition, current);
    expect(risk?.status).toBe("active");
    if (risk?.status === "active") {
      expect(risk.primaryTrigger.key).toBe("humidity");
      expect(risk.riskLevel).toBe("severe");
    }
  });
});

describe("computeProtectiveFactors", () => {
  // B12: the old component always rendered 3 hardcoded claims with zero
  // reference to the user's actual logs.
  it("returns nothing when there isn't enough data to support a claim", () => {
    const logs = [makeLog(5, ["migraine"], null)];
    expect(computeProtectiveFactors(logs)).toEqual([]);
  });

  it("surfaces a factor only when matching logs show a real severity gap", () => {
    const logs = [
      makeLog(2, ["migraine"], {
        derivative: { trend: "rising" },
      } as never),
      makeLog(3, ["migraine"], {
        derivative: { trend: "rising" },
      } as never),
      makeLog(8, ["migraine"], {
        derivative: { trend: "falling" },
      } as never),
      makeLog(9, ["migraine"], {
        derivative: { trend: "falling" },
      } as never),
    ];
    const factors = computeProtectiveFactors(logs);
    expect(factors.length).toBe(1);
    expect(factors[0].label).toMatch(/Rising pressure/);
    expect(factors[0].matchedAvgSeverity).toBe(2.5);
  });

  it("does not surface a factor when the severity gap is too small", () => {
    const logs = [
      makeLog(5, ["migraine"], {
        derivative: { trend: "rising" },
      } as never),
      makeLog(5, ["migraine"], {
        derivative: { trend: "rising" },
      } as never),
      makeLog(5.5, ["migraine"], {
        derivative: { trend: "falling" },
      } as never),
      makeLog(5.5, ["migraine"], {
        derivative: { trend: "falling" },
      } as never),
    ];
    expect(computeProtectiveFactors(logs)).toEqual([]);
  });
});
