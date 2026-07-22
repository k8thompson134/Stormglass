// NOTE: These risk functions are duplicated from frontend/src/utils/healthLogic.ts.
// If you update thresholds or logic here, update the frontend copy too (and vice versa).
// Long-term home for this logic is the shared/ package once its build is wired up.
import type { HealthRisk, RiskLevel } from './healthTypes.js';
import { MIGRAINE_CONFIG, MECFS_CONFIG, GEOMAGNETIC_CONFIG, AQI_CONFIG, type RiskConfig } from './healthRisks.js';
import { toF } from './conversions.js';

function evaluateRisk(value: number, config: RiskConfig): HealthRisk {
  const match = config.thresholds.find(t => value >= (t.min ?? -Infinity) && value <= (t.max ?? Infinity))
    || config.thresholds[config.thresholds.length - 1];

  const currentFactors = [...(match.factors || [])];

  if (config.condition === 'Migraine') {
    currentFactors.unshift(`Pressure change: ${value.toFixed(2)} hPa/hour (${match.level})`);
  } else if (config.condition === 'ME/CFS / PEM') {
    currentFactors.unshift(`Volatility index: ${value.toFixed(2)}`);
  }

  return {
    condition: config.condition,
    risk: match.level,
    trigger: config.triggerLabel,
    description: match.description,
    icon: config.icon,
    detailedExplanation: match.detailedExplanation,
    currentFactors,
    recommendations: [...(match.recommendations || [])]
  };
}


// Short-term PM2.5/ozone exposure is linked in several studies to increased migraine
// frequency via systemic inflammation and oxidative stress -- treated here as a mild
// amplifier of the pressure-driven risk rather than an independent trigger, since
// pressure change is still the dominant, best-evidenced driver for this condition.
function aqiMigraineMultiplier(usAqi: number | null): number {
  if (usAqi === null) return 1;
  if (usAqi > 150) return 1.25;
  if (usAqi > 100) return 1.15;
  return 1;
}

export function getMigraineRisk(delta: number, usAqi: number | null = null): HealthRisk {
  const abs = Math.abs(delta);
  const multiplier = aqiMigraineMultiplier(usAqi);
  const risk = evaluateRisk(abs * multiplier, MIGRAINE_CONFIG);

  if (multiplier > 1) {
    risk.currentFactors.push(`Air quality (AQI ${usAqi}) is amplifying migraine risk`);
  }

  return risk;
}

export function getMECFSRisk(delta1h: number, delta3h: number, delta6h: number, usAqi: number | null = null): HealthRisk {
  const volatility = Math.abs(delta1h) + Math.abs(delta3h) + Math.abs(delta6h);
  // ME/CFS/PEM is driven by cumulative environmental/immune burden -- elevated air
  // quality is a plausible added burden on top of pressure volatility, not a separate
  // trigger, so it's folded into the same volatility score rather than scored alone.
  const aqiBurden = usAqi !== null && usAqi > 150 ? 0.5 : usAqi !== null && usAqi > 100 ? 0.25 : 0;
  const risk = evaluateRisk(volatility + aqiBurden, MECFS_CONFIG);

  risk.currentFactors = [
    `1-hour change: ${delta1h.toFixed(2)} hPa/hour`,
    `3-hour change: ${delta3h.toFixed(2)} hPa/hour`,
    `6-hour change: ${delta6h.toFixed(2)} hPa/hour`,
    `Total volatility: ${volatility.toFixed(2)} (${risk.risk})`,
    ...(aqiBurden > 0 ? [`Air quality (AQI ${usAqi}) adding to environmental burden`] : []),
    ...(risk.currentFactors || [])
  ];

  return risk;
}

export function getGeomagneticRisk(geo: { kpIndex: number; solarWindSpeed: number; solarWindDensity: number } | null): HealthRisk {
  if (!geo) return {
    condition: 'Geomagnetic Storm',
    risk: 'low',
    trigger: 'Solar Activity',
    description: 'Geomagnetic data is currently unavailable.',
    icon: '🧲',
    detailedExplanation: 'The app could not retrieve current geomagnetic information. Conditions may still be quiet, but the system cannot rate this risk level right now.',
    currentFactors: ['No recent geomagnetic readings available'],
    recommendations: ['If you know you are sensitive to geomagnetic changes, you can check a trusted space‑weather source directly']
  };

  const risk = evaluateRisk(geo.kpIndex, GEOMAGNETIC_CONFIG);

  const specificFactors = [`Kp Index: ${geo.kpIndex.toFixed(2)}`];
  if (geo.solarWindSpeed > 0) specificFactors.push(`Solar Wind Speed: ${geo.solarWindSpeed.toFixed(0)} km/s`);
  if (geo.solarWindDensity > 0) specificFactors.push(`Solar Wind Density: ${geo.solarWindDensity.toFixed(1)} p/cm³`);

  risk.currentFactors = [...specificFactors, ...risk.currentFactors];

  const kpCategory = geo.kpIndex >= 7 ? 'Severe Storm' : geo.kpIndex >= 4 ? 'Unsettled' : 'Quiet';
  risk.trigger = `Kp Index ${geo.kpIndex.toFixed(2)} — ${kpCategory}`;
  risk.description = `Kp Index is ${geo.kpIndex.toFixed(2)} (${kpCategory}). ${risk.description}`;

  return risk;
}

export interface AQIHyperlocal {
  usAqi: number;
  pm25: number;
  sensorCount: number;
  nearestMiles: number;
}

export interface AQISmokeTrend {
  direction: 'worsening' | 'improving' | 'stable';
  currentPm25: number;
  next24hPeakPm25: number;
  next24hPeakUsAqi: number;
  next24hPeakAt: string | Date | null;
  likelyWildfireSmoke: boolean;
}

export interface AQIData {
  usAqi: number;
  pm25: number;
  pm10: number;
  ozone: number;
  no2: number;
  so2: number;
  co: number;
  hyperlocal?: AQIHyperlocal | null;
  smokeTrend?: AQISmokeTrend | null;
}

export function getAQIRisk(aqiData: AQIData | null): HealthRisk {
  if (!aqiData) return {
    condition: 'Air Quality',
    risk: 'low',
    trigger: 'Particulate Matter',
    description: 'Air quality data is currently unavailable.',
    icon: '🌫️',
    detailedExplanation: 'The app could not retrieve current air quality information, so this risk estimate is based only on other factors.',
    currentFactors: ['No recent AQI readings from the data source'],
    recommendations: ['If air quality is a key trigger for you, check a local AQI or pollution report']
  };

  const hyperlocal = aqiData.hyperlocal ?? null;
  const smokeTrend = aqiData.smokeTrend ?? null;

  // PurpleAir's dense sensor network catches localized smoke plumes that the
  // ~11km-grid regional model can miss or lag; take the worse (higher) of the two
  // readings so the risk level errs toward protecting against smoke the model hasn't
  // caught up to yet, rather than averaging it away.
  const effectiveAqi = hyperlocal ? Math.max(aqiData.usAqi, hyperlocal.usAqi) : aqiData.usAqi;

  const risk = evaluateRisk(effectiveAqi, AQI_CONFIG);

  const pollutants = [
    `US AQI (regional model): ${aqiData.usAqi}`,
    `PM2.5: ${aqiData.pm25.toFixed(1)} μg/m³`,
    `PM10: ${aqiData.pm10.toFixed(1)} μg/m³`
  ];
  if (hyperlocal) {
    pollutants.push(`US AQI (${hyperlocal.sensorCount} nearby sensors, ${hyperlocal.nearestMiles.toFixed(1)} mi): ${hyperlocal.usAqi} — PM2.5 ${hyperlocal.pm25.toFixed(1)} μg/m³`);
    // Normally the 3 nearest sensors are averaged together; fewer than that (a rural
    // or low-density area) means a single miscalibrated or obstructed sensor has much
    // more influence on the reading, so flag it rather than presenting it with the
    // same confidence as a 3-sensor average.
    if (hyperlocal.sensorCount < 3) {
      pollutants.push(`Only ${hyperlocal.sensorCount} nearby sensor${hyperlocal.sensorCount === 1 ? '' : 's'} available — hyperlocal reading is lower-confidence than usual`);
    }
  }
  if (aqiData.ozone > 0) pollutants.push(`Ozone (O₃): ${aqiData.ozone.toFixed(1)} μg/m³`);
  if (aqiData.no2 > 0) pollutants.push(`NO₂: ${aqiData.no2.toFixed(1)} μg/m³`);

  risk.currentFactors = [...pollutants, ...risk.currentFactors];

  if (smokeTrend?.likelyWildfireSmoke) {
    risk.currentFactors.unshift('Pollutant mix looks like wildfire smoke, not general pollution');
  }

  if (smokeTrend?.direction === 'worsening') {
    risk.recommendations.unshift(`Smoke is trending worse, headed toward ~AQI ${smokeTrend.next24hPeakUsAqi} within 24h — close up windows and set up filtration now rather than waiting`);
  } else if (smokeTrend?.direction === 'improving') {
    risk.recommendations.push('Air quality is trending better — conditions are likely past their worst point for now.');
  }

  const effectivePm25 = hyperlocal ? Math.max(aqiData.pm25, hyperlocal.pm25) : aqiData.pm25;
  if (effectivePm25 > 35) {
    risk.recommendations.push(`PM2.5 is elevated (${effectivePm25.toFixed(1)} μg/m³) — consider wearing a well-fitting N95 outdoors`);
  }

  const aqiCategory = effectiveAqi >= 200 ? 'Very Unhealthy' : effectiveAqi >= 150 ? 'Unhealthy' : effectiveAqi >= 100 ? 'Unhealthy for Sensitive Groups' : effectiveAqi >= 51 ? 'Moderate' : 'Good';
  risk.trigger = `US AQI ${effectiveAqi} — ${aqiCategory}`;
  risk.description = `Current US AQI is ${effectiveAqi} (${aqiCategory})${hyperlocal ? ', from nearby ground sensors' : ''}. ${risk.description}`;

  return risk;
}

export function getPOTSRisk(delta: number, humidity: number, temp: number, usAqi: number | null = null): HealthRisk {
  const tempF = toF(temp);
  const isFalling = delta < -0.3;
  const isHot = temp > 24;
  const isVeryHot = temp > 30;
  const isCold = temp < 5;
  const isVeryCold = temp < -5;
  const isDamp = humidity > 65;
  // Air pollution exposure is associated with autonomic/cardiovascular dysregulation
  // via oxidative stress -- a plausible, modest additional load for POTS.
  const isPolluted = usAqi !== null && usAqi > 100;

  let score = 0;
  if (isFalling) score += 2;
  if (isHot) score += 1;
  if (isVeryHot) score += 2;
  if (isCold) score += 1;
  if (isVeryCold) score += 1;
  if (isDamp) score += 1;
  if (Math.abs(delta) > 0.8) score += 1;
  if (isPolluted) score += 1;

  const primaryStressor = isVeryHot || isHot ? 'heat' : (isVeryCold || isCold ? 'cold' : 'pressure');

  let risk: RiskLevel = 'low';
  let description = 'Environmental factors for dysautonomia look relatively stable.';
  let detailedExplanation = 'Right now, temperature, humidity, and pressure changes are not adding much extra load on your autonomic nervous system.';
  const currentFactors: string[] = [];
  const recommendations: string[] = [];

  if (score >= 5) {
    risk = 'severe';
    description = 'Strong combination of heat/cold, humidity, and pressure swings. High risk of POTS symptom flare.';
    detailedExplanation = 'Several stressors are stacking at once (temperature extremes, humidity, and rapid pressure changes). Together they can make it harder for your body to regulate heart rate and blood pressure, increasing chances of dizziness, tachycardia, and fatigue.';
    recommendations.push(primaryStressor === 'heat' ? 'Stay in the coolest comfortable environment you can' : 'Stay in a warm, draft‑free space');
  } else if (score >= 3) {
    risk = 'high';
    description = 'Weather conditions may noticeably worsen orthostatic intolerance.';
    detailedExplanation = 'Heat, cold, humidity, and pressure shifts are adding clear extra load for your autonomic nervous system. This can make standing or being upright more draining, and you may notice more dizziness, brain fog, or heart‑rate spikes than usual.';
  } else if (score >= 1) {
    risk = 'moderate';
    description = 'Mild weather stressors are present and could nudge symptoms upward.';
    detailedExplanation = 'There are some mild temperature, humidity, or pressure changes today. On their own they are not extreme, but they can slightly increase orthostatic stress, especially if you are already pushing your limits.';
  }

  currentFactors.push(`Temperature: ${tempF}°F`);
  currentFactors.push(`Humidity: ${humidity.toFixed(0)}%`);
  currentFactors.push(`Pressure change: ${delta.toFixed(2)} hPa/hour`);
  if (isPolluted) currentFactors.push(`Air quality (AQI ${usAqi}) adding autonomic load`);

  return {
    condition: 'POTS / Dysautonomia',
    risk,
    trigger: 'Combined Factors',
    description,
    icon: '🫀',
    detailedExplanation: detailedExplanation || description,
    currentFactors,
    recommendations: ['Stay hydrated', 'Monitor symptoms', ...recommendations]
  };
}

export function getJointPainRisk(delta: number, humidity: number, temp: number, usAqi: number | null = null): HealthRisk {
  const tempF = toF(temp);
  // Air pollution's systemic inflammatory effect is linked to increased inflammatory
  // arthritis symptoms in several studies -- a modest additional contributor here.
  const isPolluted = usAqi !== null && usAqi > 100;

  let risk: RiskLevel = 'low';
  let score = 0;
  if (Math.abs(delta) > 0.5) score += 2;
  if (temp < 10) score += 1;
  if (humidity > 60) score += 1;
  if (isPolluted) score += 1;

  if (score >= 4) risk = 'severe';
  else if (score >= 3) risk = 'high';
  else if (score >= 1) risk = 'moderate';

  return {
    condition: 'Joint Pain (Arthritis)',
    risk,
    trigger: 'Pressure/Cold/Humidity',
    description: risk === 'low'
      ? 'Conditions look friendly for joint comfort.'
      : 'Today\'s pressure, temperature, and humidity may aggravate joint pain.',
    icon: '🦴',
    detailedExplanation: 'Rapid pressure shifts, cold air, and damp conditions can change how joints and surrounding tissues feel. In people with arthritis or similar conditions, this may show up as stiffness, aching, or swelling.',
    currentFactors: [
      `Temperature: ${tempF}°F`,
      `Humidity: ${humidity.toFixed(0)}%`,
      `Pressure change: ${delta.toFixed(2)} hPa/hour`,
      ...(isPolluted ? [`Air quality (AQI ${usAqi}) may add inflammatory load`] : []),
    ],
    recommendations: ['Keep joints warm and protected', 'Use gentle movement or stretching within your comfort range']
  };
}

export function getPollenRisk(pollen: { treeIndex: number; grassIndex: number; weedIndex: number; moldIndex: number } | null): HealthRisk {
  if (!pollen) return {
    condition: 'Pollen & Mold', risk: 'low', trigger: 'Allergen Index', description: 'No data.', icon: '🌿', detailedExplanation: '', currentFactors: [], recommendations: []
  };

  const maxIndex = Math.max(pollen.treeIndex, pollen.grassIndex, pollen.weedIndex, pollen.moldIndex);
  let risk: RiskLevel = 'low';
  if (maxIndex >= 5) risk = 'severe';
  else if (maxIndex >= 4) risk = 'high';
  else if (maxIndex >= 3) risk = 'moderate';

  return {
    condition: 'Pollen & Mold',
    risk,
    trigger: 'Allergen Index',
    description: `Airborne allergen levels are ${['none', 'very low', 'low', 'medium', 'high', 'very high'][maxIndex] || 'unknown'}.`,
    icon: '🌿',
    detailedExplanation: 'Tree, grass, weed pollen and mold spores can irritate the nose, sinuses, lungs, and eyes. For people with allergies, this may increase congestion, sneezing, cough, or asthma symptoms.',
    currentFactors: [`Highest allergen index today: ${maxIndex}`],
    recommendations: ['Monitor local pollen reports if allergies are a major trigger for you']
  };
}
