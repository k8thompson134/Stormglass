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

  it('appends PM2.5 mask recommendation when elevated', () => {
    const result = getAQIRisk({ ...base, usAqi: 80, pm25: 40 });
    expect(result.recommendations.some(r => r.includes('mask'))).toBe(true);
  });

  it('does not append PM2.5 mask recommendation when not elevated', () => {
    const result = getAQIRisk({ ...base, usAqi: 80, pm25: 10 });
    expect(result.recommendations.some(r => r.includes('mask'))).toBe(false);
  });

  it('includes AQI value in trigger label', () => {
    const result = getAQIRisk({ ...base, usAqi: 120 });
    expect(result.trigger).toMatch(/120/);
    expect(result.trigger).toMatch(/Sensitive Groups/);
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
