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


export function getMigraineRisk(delta: number): HealthRisk {
  const abs = Math.abs(delta);
  return evaluateRisk(abs, MIGRAINE_CONFIG);
}

export function getMECFSRisk(delta1h: number, delta3h: number, delta6h: number): HealthRisk {
  const volatility = Math.abs(delta1h) + Math.abs(delta3h) + Math.abs(delta6h);
  const risk = evaluateRisk(volatility, MECFS_CONFIG);

  risk.currentFactors = [
    `1-hour change: ${delta1h.toFixed(2)} hPa/hour`,
    `3-hour change: ${delta3h.toFixed(2)} hPa/hour`,
    `6-hour change: ${delta6h.toFixed(2)} hPa/hour`,
    `Total volatility: ${volatility.toFixed(2)} (${risk.risk})`,
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

export function getAQIRisk(aqiData: { usAqi: number; pm25: number; pm10: number; ozone: number; no2: number; so2: number; co: number; } | null): HealthRisk {
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

  const risk = evaluateRisk(aqiData.usAqi, AQI_CONFIG);

  const pollutants = [
    `US AQI: ${aqiData.usAqi}`,
    `PM2.5: ${aqiData.pm25.toFixed(1)} μg/m³`,
    `PM10: ${aqiData.pm10.toFixed(1)} μg/m³`
  ];
  if (aqiData.ozone > 0) pollutants.push(`Ozone (O₃): ${aqiData.ozone.toFixed(1)} μg/m³`);
  if (aqiData.no2 > 0) pollutants.push(`NO₂: ${aqiData.no2.toFixed(1)} μg/m³`);

  risk.currentFactors = [...pollutants, ...risk.currentFactors];

  if (aqiData.pm25 > 35) {
    risk.recommendations.push(`PM2.5 is elevated (${aqiData.pm25.toFixed(1)} μg/m³) — consider wearing a mask outdoors`);
  }

  const aqiCategory = aqiData.usAqi >= 200 ? 'Very Unhealthy' : aqiData.usAqi >= 150 ? 'Unhealthy' : aqiData.usAqi >= 100 ? 'Unhealthy for Sensitive Groups' : aqiData.usAqi >= 51 ? 'Moderate' : 'Good';
  risk.trigger = `US AQI ${aqiData.usAqi} — ${aqiCategory}`;
  risk.description = `Current US AQI is ${aqiData.usAqi} (${aqiCategory}). ${risk.description}`;

  return risk;
}

export function getPOTSRisk(delta: number, humidity: number, temp: number): HealthRisk {
  const tempF = toF(temp);
  const isFalling = delta < -0.3;
  const isHot = temp > 24;
  const isVeryHot = temp > 30;
  const isCold = temp < 5;
  const isVeryCold = temp < -5;
  const isDamp = humidity > 65;

  let score = 0;
  if (isFalling) score += 2;
  if (isHot) score += 1;
  if (isVeryHot) score += 2;
  if (isCold) score += 1;
  if (isVeryCold) score += 1;
  if (isDamp) score += 1;
  if (Math.abs(delta) > 0.8) score += 1;

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

export function getJointPainRisk(delta: number, humidity: number, temp: number): HealthRisk {
  const tempF = toF(temp);

  let risk: RiskLevel = 'low';
  let score = 0;
  if (Math.abs(delta) > 0.5) score += 2;
  if (temp < 10) score += 1;
  if (humidity > 60) score += 1;

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
    currentFactors: [`Temperature: ${tempF}°F`, `Humidity: ${humidity.toFixed(0)}%`, `Pressure change: ${delta.toFixed(2)} hPa/hour`],
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
