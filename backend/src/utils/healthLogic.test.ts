import { describe, it, expect } from 'vitest';
import {
  getMigraineRisk,
  getMECFSRisk,
  getGeomagneticRisk,
  getAQIRisk,
  getPOTSRisk,
  getJointPainRisk,
  getPollenRisk,
} from './healthLogic.js';

// ---------------------------------------------------------------------------
// getMigraineRisk
// ---------------------------------------------------------------------------
describe('getMigraineRisk', () => {
  it('low — stable pressure', () => {
    expect(getMigraineRisk(0).risk).toBe('low');
    expect(getMigraineRisk(0.1).risk).toBe('low');
    expect(getMigraineRisk(0.39).risk).toBe('low');
  });

  it('moderate — crosses 0.4 threshold', () => {
    expect(getMigraineRisk(0.4).risk).toBe('moderate');
    expect(getMigraineRisk(0.7).risk).toBe('moderate');
    expect(getMigraineRisk(0.79).risk).toBe('moderate');
  });

  it('high — crosses 0.8 threshold', () => {
    expect(getMigraineRisk(0.8).risk).toBe('high');
    expect(getMigraineRisk(1.2).risk).toBe('high');
    expect(getMigraineRisk(1.49).risk).toBe('high');
  });

  it('severe — crosses 1.5 threshold', () => {
    expect(getMigraineRisk(1.5).risk).toBe('severe');
    expect(getMigraineRisk(3.0).risk).toBe('severe');
  });

  it('uses absolute value — negative delta treated same as positive', () => {
    expect(getMigraineRisk(-2.0).risk).toBe('severe');
    expect(getMigraineRisk(-0.5).risk).toBe('moderate');
  });

  it('includes pressure change in currentFactors', () => {
    const result = getMigraineRisk(0.6);
    expect(result.currentFactors[0]).toMatch(/0\.60 hPa\/hour/);
  });

  it('returns non-empty recommendations', () => {
    expect(getMigraineRisk(1.0).recommendations.length).toBeGreaterThan(0);
  });

  it('elevated AQI amplifies an otherwise-moderate pressure reading into high', () => {
    // 0.7 alone is moderate (< 0.8 threshold); * 1.15 = 0.805, crosses into high.
    expect(getMigraineRisk(0.7, null).risk).toBe('moderate');
    expect(getMigraineRisk(0.7, 130).risk).toBe('high');
    const withAqi = getMigraineRisk(0.7, 130);
    expect(withAqi.currentFactors.some(f => f.includes('130'))).toBe(true);
  });

  it('does not amplify or annotate when AQI is not elevated', () => {
    const clean = getMigraineRisk(0.7, 50);
    expect(clean.risk).toBe(getMigraineRisk(0.7, null).risk);
    expect(clean.currentFactors.some(f => f.toLowerCase().includes('air quality'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getMECFSRisk
// ---------------------------------------------------------------------------
describe('getMECFSRisk', () => {
  it('low — all deltas near zero', () => {
    expect(getMECFSRisk(0, 0, 0).risk).toBe('low');
    expect(getMECFSRisk(0.1, 0.1, 0.1).risk).toBe('low');
  });

  it('moderate — volatility crosses 0.8', () => {
    // 0.3 + 0.3 + 0.3 = 0.9
    expect(getMECFSRisk(0.3, 0.3, 0.3).risk).toBe('moderate');
  });

  it('high — volatility crosses 1.5', () => {
    // 0.6 + 0.5 + 0.5 = 1.6
    expect(getMECFSRisk(0.6, 0.5, 0.5).risk).toBe('high');
  });

  it('severe — volatility crosses 2.5', () => {
    // 1.0 + 0.9 + 0.7 = 2.6
    expect(getMECFSRisk(1.0, 0.9, 0.7).risk).toBe('severe');
  });

  it('mixes signs — uses absolute values in volatility sum', () => {
    // |-1.0| + |-0.9| + |0.7| = 2.6 → severe
    expect(getMECFSRisk(-1.0, -0.9, 0.7).risk).toBe('severe');
  });

  it('includes all three delta values in currentFactors', () => {
    const result = getMECFSRisk(0.5, 0.4, 0.3);
    const factors = result.currentFactors.join(' ');
    expect(factors).toMatch(/1-hour/);
    expect(factors).toMatch(/3-hour/);
    expect(factors).toMatch(/6-hour/);
    expect(factors).toMatch(/Total volatility/);
  });

  it('high AQI adds environmental burden and can tip volatility into a higher tier', () => {
    // 0.25+0.25+0.2 = 0.7 alone is low (< 0.8); +0.25 AQI burden = 0.95, crosses into moderate.
    expect(getMECFSRisk(0.25, 0.25, 0.2, null).risk).toBe('low');
    expect(getMECFSRisk(0.25, 0.25, 0.2, 130).risk).toBe('moderate');
  });

  it('does not add a burden note when AQI is not elevated', () => {
    const clean = getMECFSRisk(0.25, 0.25, 0.2, 50);
    expect(clean.currentFactors.some(f => f.toLowerCase().includes('air quality'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getGeomagneticRisk
// ---------------------------------------------------------------------------
describe('getGeomagneticRisk', () => {
  it('returns low when passed null (no data)', () => {
    const result = getGeomagneticRisk(null);
    expect(result.risk).toBe('low');
    expect(result.condition).toBe('Geomagnetic Storm');
  });

  it('low — Kp index below 4', () => {
    expect(getGeomagneticRisk({ kpIndex: 0, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('low');
    expect(getGeomagneticRisk({ kpIndex: 3.9, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('low');
  });

  it('moderate — Kp index crosses 4', () => {
    expect(getGeomagneticRisk({ kpIndex: 4, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('moderate');
    expect(getGeomagneticRisk({ kpIndex: 4.9, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('moderate');
  });

  it('high — Kp index crosses 5', () => {
    expect(getGeomagneticRisk({ kpIndex: 5, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('high');
    expect(getGeomagneticRisk({ kpIndex: 6.9, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('high');
  });

  it('severe — Kp index crosses 7', () => {
    expect(getGeomagneticRisk({ kpIndex: 7, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('severe');
    expect(getGeomagneticRisk({ kpIndex: 9, solarWindSpeed: 0, solarWindDensity: 0 }).risk).toBe('severe');
  });

  it('includes Kp index in trigger label', () => {
    const result = getGeomagneticRisk({ kpIndex: 6, solarWindSpeed: 450, solarWindDensity: 5 });
    expect(result.trigger).toMatch(/Kp Index 6\.00/);
    expect(result.trigger).toMatch(/Unsettled/);
  });

  it('includes solar wind in currentFactors when > 0', () => {
    const result = getGeomagneticRisk({ kpIndex: 3, solarWindSpeed: 420, solarWindDensity: 4.5 });
    const factors = result.currentFactors.join(' ');
    expect(factors).toMatch(/420 km\/s/);
    expect(factors).toMatch(/4\.5 p\/cm³/);
  });

  it('omits solar wind from factors when 0', () => {
    const result = getGeomagneticRisk({ kpIndex: 3, solarWindSpeed: 0, solarWindDensity: 0 });
    const factors = result.currentFactors.join(' ');
    expect(factors).not.toMatch(/km\/s/);
  });
});

// ---------------------------------------------------------------------------
// getAQIRisk
// ---------------------------------------------------------------------------
describe('getAQIRisk', () => {
  const base = { pm25: 5, pm10: 10, ozone: 30, no2: 8, so2: 2, co: 200 };

  it('returns low when passed null (no data)', () => {
    expect(getAQIRisk(null).risk).toBe('low');
  });

  it('low — AQI 0–50', () => {
    expect(getAQIRisk({ ...base, usAqi: 0 }).risk).toBe('low');
    expect(getAQIRisk({ ...base, usAqi: 50 }).risk).toBe('low');
  });

  it('low — AQI 51–99 (moderate band, still low risk level)', () => {
    expect(getAQIRisk({ ...base, usAqi: 51 }).risk).toBe('low');
    expect(getAQIRisk({ ...base, usAqi: 99 }).risk).toBe('low');
  });

  it('moderate — AQI crosses 100', () => {
    expect(getAQIRisk({ ...base, usAqi: 100 }).risk).toBe('moderate');
    expect(getAQIRisk({ ...base, usAqi: 149 }).risk).toBe('moderate');
  });

  it('high — AQI crosses 150', () => {
    expect(getAQIRisk({ ...base, usAqi: 150 }).risk).toBe('high');
    expect(getAQIRisk({ ...base, usAqi: 199 }).risk).toBe('high');
  });

  it('severe — AQI crosses 200', () => {
    expect(getAQIRisk({ ...base, usAqi: 200 }).risk).toBe('severe');
    expect(getAQIRisk({ ...base, usAqi: 300 }).risk).toBe('severe');
  });

  it('appends PM2.5 N95 recommendation when elevated', () => {
    const result = getAQIRisk({ ...base, usAqi: 80, pm25: 40 });
    expect(result.recommendations.some(r => r.includes('N95'))).toBe(true);
  });

  it('does not append PM2.5 N95 recommendation when not elevated', () => {
    const result = getAQIRisk({ ...base, usAqi: 80, pm25: 10 });
    expect(result.recommendations.some(r => r.includes('N95 outdoors'))).toBe(false);
  });

  it('includes AQI value in trigger label', () => {
    const result = getAQIRisk({ ...base, usAqi: 120 });
    expect(result.trigger).toMatch(/120/);
    expect(result.trigger).toMatch(/Sensitive Groups/);
  });

  describe('hyperlocal (PurpleAir) vs. regional model disagreement', () => {
    // Real case observed live: model said AQI 35, 3 nearby PurpleAir sensors said 57.
    it('uses the worse (higher) of hyperlocal and model AQI for risk severity', () => {
      const result = getAQIRisk({
        ...base, usAqi: 35,
        hyperlocal: { usAqi: 57, pm25: 15.1, sensorCount: 3, nearestMiles: 0.4 },
      });
      expect(result.risk).toBe('low'); // both readings are still under the moderate=100 line
      expect(result.trigger).toMatch(/57/);
      expect(result.trigger).not.toMatch(/35/);
    });

    it('escalates risk level when hyperlocal is worse than the model even though the model alone would not', () => {
      const modelOnly = getAQIRisk({ ...base, usAqi: 90 });
      const withHyperlocal = getAQIRisk({
        ...base, usAqi: 90,
        hyperlocal: { usAqi: 160, pm25: 70, sensorCount: 3, nearestMiles: 0.6 },
      });
      expect(modelOnly.risk).toBe('low');
      expect(withHyperlocal.risk).toBe('high');
    });

    it('still favors the worse reading when the model is higher than hyperlocal (does not just prefer PurpleAir)', () => {
      const result = getAQIRisk({
        ...base, usAqi: 210,
        hyperlocal: { usAqi: 60, pm25: 18, sensorCount: 2, nearestMiles: 1.2 },
      });
      expect(result.risk).toBe('severe');
      expect(result.trigger).toMatch(/210/);
    });

    it('falls back to the model AQI alone when hyperlocal is null (key unset or fetch failed)', () => {
      const result = getAQIRisk({ ...base, usAqi: 120, hyperlocal: null });
      expect(result.risk).toBe('moderate');
      expect(result.trigger).toMatch(/120/);
    });

    it('does not error when hyperlocal/smokeTrend are simply omitted from the input', () => {
      expect(() => getAQIRisk({ ...base, usAqi: 80 })).not.toThrow();
    });

    it('flags low confidence when hyperlocal is based on fewer than 3 sensors', () => {
      const oneS = getAQIRisk({ ...base, usAqi: 80, hyperlocal: { usAqi: 90, pm25: 30, sensorCount: 1, nearestMiles: 2.0 } });
      expect(oneS.currentFactors.some(f => f.includes('lower-confidence'))).toBe(true);
      expect(oneS.currentFactors.some(f => f.includes('Only 1 nearby sensor '))).toBe(true);

      const twoS = getAQIRisk({ ...base, usAqi: 80, hyperlocal: { usAqi: 90, pm25: 30, sensorCount: 2, nearestMiles: 2.0 } });
      expect(twoS.currentFactors.some(f => f.includes('Only 2 nearby sensors'))).toBe(true);
    });

    it('does not flag low confidence with the usual 3-sensor average', () => {
      const result = getAQIRisk({ ...base, usAqi: 80, hyperlocal: { usAqi: 90, pm25: 30, sensorCount: 3, nearestMiles: 0.5 } });
      expect(result.currentFactors.some(f => f.includes('lower-confidence'))).toBe(false);
    });
  });

  describe('smoke trend messaging', () => {
    it('leads with a worsening-smoke warning including the forecast peak', () => {
      const result = getAQIRisk({
        ...base, usAqi: 80,
        smokeTrend: {
          direction: 'worsening', currentPm25: 40, next24hPeakPm25: 120,
          next24hPeakUsAqi: 175, next24hPeakAt: null, likelyWildfireSmoke: true,
        },
      });
      expect(result.recommendations[0]).toMatch(/worse/);
      expect(result.recommendations[0]).toMatch(/175/);
      expect(result.currentFactors[0]).toMatch(/wildfire smoke/);
    });

    it('adds an improving note without alarming language when trend is improving', () => {
      const result = getAQIRisk({
        ...base, usAqi: 60,
        smokeTrend: {
          direction: 'improving', currentPm25: 15, next24hPeakPm25: 15,
          next24hPeakUsAqi: 60, next24hPeakAt: null, likelyWildfireSmoke: false,
        },
      });
      expect(result.recommendations.some(r => r.includes('trending better'))).toBe(true);
    });

    it('adds neither message when trend is stable', () => {
      const result = getAQIRisk({
        ...base, usAqi: 60,
        smokeTrend: {
          direction: 'stable', currentPm25: 15, next24hPeakPm25: 15,
          next24hPeakUsAqi: 60, next24hPeakAt: null, likelyWildfireSmoke: false,
        },
      });
      expect(result.recommendations.some(r => r.includes('trending worse') || r.includes('trending better'))).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getPOTSRisk
// ---------------------------------------------------------------------------
describe('getPOTSRisk', () => {
  it('low — benign conditions (stable, mild temp, low humidity)', () => {
    expect(getPOTSRisk(0, 50, 18).risk).toBe('low');
  });

  it('moderate — single mild stressor (slightly damp)', () => {
    // humidity > 65 = +1 → score 1
    expect(getPOTSRisk(0, 70, 18).risk).toBe('moderate');
  });

  it('high — falling pressure + damp', () => {
    // falling (-0.5) = +2, humidity 70 = +1 → score 3
    expect(getPOTSRisk(-0.5, 70, 18).risk).toBe('high');
  });

  it('severe — falling pressure + very hot + damp', () => {
    // falling (-0.5) = +2, hot (35°C) = +1 + +2, damp = +1 → score 6
    expect(getPOTSRisk(-0.5, 70, 35).risk).toBe('severe');
  });

  it('includes temperature, humidity, pressure in currentFactors', () => {
    const result = getPOTSRisk(-0.4, 55, 20);
    const factors = result.currentFactors.join(' ');
    expect(factors).toMatch(/Temperature/);
    expect(factors).toMatch(/Humidity/);
    expect(factors).toMatch(/Pressure change/);
  });

  it('always includes "Stay hydrated" in recommendations', () => {
    expect(getPOTSRisk(0, 50, 18).recommendations).toContain('Stay hydrated');
  });

  it('elevated AQI adds a point and can tip low into moderate', () => {
    expect(getPOTSRisk(0, 50, 18, null).risk).toBe('low');
    expect(getPOTSRisk(0, 50, 18, 130).risk).toBe('moderate');
    expect(getPOTSRisk(0, 50, 18, 130).currentFactors.some(f => f.includes('130'))).toBe(true);
  });

  it('AQI at or below 100 does not contribute', () => {
    expect(getPOTSRisk(0, 50, 18, 100).risk).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// getJointPainRisk
// ---------------------------------------------------------------------------
describe('getJointPainRisk', () => {
  it('low — mild conditions', () => {
    expect(getJointPainRisk(0.1, 50, 15).risk).toBe('low');
  });

  it('moderate — pressure change crosses 0.5', () => {
    // |0.6| > 0.5 → +2 → score 2
    expect(getJointPainRisk(0.6, 50, 15).risk).toBe('moderate');
  });

  it('high — pressure + cold', () => {
    // |0.6| > 0.5 → +2, temp < 10 → +1 → score 3
    expect(getJointPainRisk(0.6, 50, 8).risk).toBe('high');
  });

  it('severe — pressure + cold + damp', () => {
    // |0.6| > 0.5 → +2, temp < 10 → +1, humidity > 60 → +1 → score 4
    expect(getJointPainRisk(0.6, 65, 8).risk).toBe('severe');
  });

  it('uses absolute value of delta', () => {
    expect(getJointPainRisk(-0.6, 50, 15).risk).toBe('moderate');
  });

  it('low description is distinct from symptomatic description', () => {
    const low = getJointPainRisk(0, 50, 15);
    const high = getJointPainRisk(0.6, 65, 8);
    expect(low.description).not.toBe(high.description);
    expect(low.description).toMatch(/friendly/i);
  });

  it('elevated AQI adds a point and can tip low into moderate', () => {
    expect(getJointPainRisk(0.1, 50, 15, null).risk).toBe('low');
    expect(getJointPainRisk(0.1, 50, 15, 130).risk).toBe('moderate');
    expect(getJointPainRisk(0.1, 50, 15, 130).currentFactors.some(f => f.includes('130'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPollenRisk
// ---------------------------------------------------------------------------
describe('getPollenRisk', () => {
  it('returns low when passed null (no data)', () => {
    expect(getPollenRisk(null).risk).toBe('low');
  });

  it('low — all indices below 3', () => {
    expect(getPollenRisk({ treeIndex: 1, grassIndex: 2, weedIndex: 1, moldIndex: 0 }).risk).toBe('low');
  });

  it('moderate — any index reaches 3', () => {
    expect(getPollenRisk({ treeIndex: 3, grassIndex: 0, weedIndex: 0, moldIndex: 0 }).risk).toBe('moderate');
    expect(getPollenRisk({ treeIndex: 0, grassIndex: 0, weedIndex: 0, moldIndex: 3 }).risk).toBe('moderate');
  });

  it('high — any index reaches 4', () => {
    expect(getPollenRisk({ treeIndex: 0, grassIndex: 4, weedIndex: 0, moldIndex: 0 }).risk).toBe('high');
  });

  it('severe — any index reaches 5', () => {
    expect(getPollenRisk({ treeIndex: 0, grassIndex: 0, weedIndex: 5, moldIndex: 0 }).risk).toBe('severe');
  });

  it('uses the max index across all four categories', () => {
    const result = getPollenRisk({ treeIndex: 1, grassIndex: 2, weedIndex: 5, moldIndex: 3 });
    expect(result.risk).toBe('severe');
    expect(result.currentFactors[0]).toMatch(/5/);
  });

  it('description reflects the correct level label', () => {
    const result = getPollenRisk({ treeIndex: 0, grassIndex: 0, weedIndex: 0, moldIndex: 2 });
    expect(result.description).toMatch(/low/i);
  });
});
