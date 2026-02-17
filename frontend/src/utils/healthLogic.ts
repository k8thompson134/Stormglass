import type { HealthRisk, RiskLevel } from '../types/health';
import { MIGRAINE_CONFIG, MECFS_CONFIG, GEOMAGNETIC_CONFIG, AQI_CONFIG, type RiskConfig } from './healthRisks';
import { toF } from './conversions';

// Helper to determine risk from a single numeric value based on simple min thresholds
function evaluateRisk(value: number, config: RiskConfig): HealthRisk {
    // Find the highest matching threshold
    const match = config.thresholds.find(t => value >= (t.min ?? -Infinity) && value <= (t.max ?? Infinity))
        || config.thresholds[config.thresholds.length - 1]; // Default to lowest risk if no match

    const currentFactors = [...(match.factors || [])];

    // Dynamic factor injection for simple cases
    if (config.condition === 'Migraine') {
        currentFactors.unshift(`Pressure change: ${value.toFixed(2)} hPa/hour (${match.level})`);
    } else if (config.condition === 'ME/CFS / PEM') {
        // Should be handled by specific logic, but fallback here
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

    // Add specific factors for ME/CFS that aren't generic
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
        description: 'No geomagnetic data available.',
        icon: '🧲',
        detailedExplanation: 'Geomagnetic data is currently unavailable.',
        currentFactors: ['Data unavailable — API connection pending'],
        recommendations: ['Monitor space weather if sensitive']
    };

    const risk = evaluateRisk(geo.kpIndex, GEOMAGNETIC_CONFIG);

    // Add specific factors
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
        description: 'No air quality data available.',
        icon: '🌫️',
        detailedExplanation: 'Air quality data is currently unavailable.',
        currentFactors: ['Data unavailable'],
        recommendations: ['Check local air quality reports']
    };

    const risk = evaluateRisk(aqiData.usAqi, AQI_CONFIG);

    // Pollutant breakdown
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

// Complex multi-factor risks (POTS, Joint Pain, Pollen) remain as functions for now due to complex logic
export function getPOTSRisk(delta: number, humidity: number, temp: number): HealthRisk {
    // Environment factors logic
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
    let description = 'Environmental factors for dysautonomia are stable.';
    let detailedExplanation = 'Environmental conditions are currently stable and favorable for maintaining autonomic balance.';
    const currentFactors: string[] = [];
    const recommendations: string[] = [];

    // Severity calculation strategy
    if (score >= 5) {
        risk = 'severe';
        description = 'Extreme heat/cold and pressure volatility. High risk of POTS symptoms.';
        detailedExplanation = 'Multiple environmental stressors (temperature and pressure volatility) are combining, which can significantly challenge autonomic regulation and increase symptom severity.';
        recommendations.push(primaryStressor === 'heat' ? 'Stay in cool environment' : 'Stay warm');
    } else if (score >= 3) {
        risk = 'high';
        description = 'Weather conditions may worsen orthostatic intolerance.';
    } else if (score >= 1) {
        risk = 'moderate';
        description = 'Minor weather stressors present.';
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
        detailedExplanation: detailedExplanation || description, // fallback
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
        description: risk === 'low' ? 'Conditions favorable for joint comfort.' : 'Weather may aggravate joint pain.',
        icon: '🦴',
        detailedExplanation: 'Pressure changes, cold, and humidity can affect joint comfort.',
        currentFactors: [`Temp: ${tempF}°F`, `Humidity: ${humidity.toFixed(0)}%`, `Pressure Δ: ${delta.toFixed(2)}`],
        recommendations: ['Stay warm', 'Gentle movement']
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
        description: `Allergen levels are ${['None', 'Very Low', 'Low', 'Medium', 'High', 'Very High'][maxIndex] || 'Unknown'}.`,
        icon: '🌿',
        detailedExplanation: 'Pollen and mold can trigger inflammation.',
        currentFactors: [`Max Index: ${maxIndex}`],
        recommendations: ['Monitor local reports']
    };
}
