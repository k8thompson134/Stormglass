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


export function getMigraineRisk(delta: number, delta3h = 0, delta6h = 0): HealthRisk {
    const abs1h = Math.abs(delta);

    // Sustained drop/rise in the same direction across all three windows amplifies risk
    const sustained =
        delta !== 0 &&
        Math.sign(delta) === Math.sign(delta3h) &&
        Math.sign(delta3h) === Math.sign(delta6h);
    const effective = sustained ? abs1h * 1.25 : abs1h;

    const result = evaluateRisk(effective, MIGRAINE_CONFIG);

    if (sustained && abs1h >= 0.3) {
        result.currentFactors.unshift(
            `Sustained ${delta < 0 ? 'falling' : 'rising'} pressure over 6+ hours — cumulative stress elevated`
        );
    }

    return result;
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
      description: 'Geomagnetic data is currently unavailable.',
        icon: '🧲',
      detailedExplanation: 'The app could not retrieve current geomagnetic information. Conditions may still be quiet, but the system cannot rate this risk level right now.',
      currentFactors: ['No recent geomagnetic readings available'],
      recommendations: ['If you know you are sensitive to geomagnetic changes, you can check a trusted space‑weather source directly']
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
      description: 'Air quality data is currently unavailable.',
        icon: '🌫️',
      detailedExplanation: 'The app could not retrieve current air quality information, so this risk estimate is based only on other factors.',
      currentFactors: ['No recent AQI readings from the data source'],
      recommendations: ['If air quality is a key trigger for you, check a local AQI or pollution report']
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
  let description = 'Environmental factors for dysautonomia look relatively stable.';
  let detailedExplanation = 'Right now, temperature, humidity, and pressure changes are not adding much extra load on your autonomic nervous system.';
    const currentFactors: string[] = [];
    const recommendations: string[] = [];

    // Severity calculation strategy
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
      description: risk === 'low'
          ? 'Conditions look friendly for joint comfort.'
          : 'Today’s pressure, temperature, and humidity may aggravate joint pain.',
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

export function getFibromyalgiaRisk(delta: number, humidity: number, temp: number): HealthRisk {
    const tempF = toF(temp);
    const absD = Math.abs(delta);

    let score = 0;
    if (absD > 0.5) score += 2;
    if (absD > 1.0) score += 1;   // large pressure swing adds more
    if (temp < 10)  score += 2;   // cold is a major fibro trigger
    if (temp < 5)   score += 1;
    if (temp > 28)  score += 1;   // heat exhaustion risk
    if (humidity > 60) score += 1;
    if (humidity > 75) score += 1;
    if (temp < 10 && humidity > 60) score += 1;  // cold+damp compound effect

    let risk: RiskLevel = 'low';
    if (score >= 5)      risk = 'severe';
    else if (score >= 3) risk = 'high';
    else if (score >= 1) risk = 'moderate';

    const descriptions: Record<RiskLevel, string> = {
        low:      'Environmental conditions are relatively gentle for fibromyalgia right now.',
        moderate: 'Some weather stress present — pain sensitivity and fatigue may be slightly elevated.',
        high:     'Significant weather triggers active. Fibromyalgia symptoms may worsen noticeably today.',
        severe:   'Multiple strong triggers stacking. High risk of flare or increased widespread pain.',
    };

    const explanations: Record<RiskLevel, string> = {
        low:      'Current temperature, humidity, and pressure are not adding significant stress for fibromyalgia. Relatively stable conditions for managing baseline symptoms.',
        moderate: 'Moderate temperature, humidity, or pressure changes may gently raise pain sensitivity and fatigue. Not extreme, but worth pacing around if you are already near your threshold.',
        high:     'Cold or damp weather combined with pressure changes puts extra load on the sensitised nervous system. This can increase widespread pain, stiffness, and fatigue beyond your usual baseline.',
        severe:   'Cold temperature, damp air, and rapid pressure changes are occurring together — one of the most reliable pain amplifiers for fibromyalgia. The nervous system\'s already elevated pain signals can intensify significantly under these conditions.',
    };

    return {
        condition: 'Fibromyalgia',
        risk,
        trigger: 'Cold / Damp / Pressure',
        description: descriptions[risk],
        icon: '🌡️',
        detailedExplanation: explanations[risk],
        currentFactors: [
            `Temperature: ${tempF}°F`,
            `Humidity: ${humidity.toFixed(0)}%`,
            `Pressure change: ${delta.toFixed(2)} hPa/hour`,
        ],
        recommendations: [
            'Keep warm and layer clothing in cold or damp conditions',
            'Use heat packs or warm baths to ease stiffness',
            'Pace activity carefully — weather flares often lag by several hours',
            'Stay hydrated and maintain gentle movement within your limits',
        ],
    };
}

export function getSinusRisk(delta: number, humidity: number, temp: number, pollenMax = 0): HealthRisk {
    const absD = Math.abs(delta);
    let score = 0;

    if (absD > 0.4) score += 2;
    if (absD > 0.8) score += 1;
    if (humidity > 65) score += 1;
    if (humidity > 80) score += 1;
    if (temp < 5)  score += 1;   // cold dry air irritates sinuses
    if (pollenMax >= 3) score += 1;
    if (pollenMax >= 5) score += 1;

    let risk: RiskLevel = 'low';
    if (score >= 5)      risk = 'severe';
    else if (score >= 3) risk = 'high';
    else if (score >= 1) risk = 'moderate';

    const descriptions: Record<RiskLevel, string> = {
        low:      'Sinus conditions look relatively comfortable today.',
        moderate: 'Some pressure or humidity changes may cause mild sinus congestion or pressure.',
        high:     'Weather conditions are likely to aggravate sinus symptoms noticeably.',
        severe:   'Multiple sinus triggers active — expect significant pressure, congestion, or pain.',
    };

    const tempF = toF(temp);
    return {
        condition: 'Sinus / Sinusitis',
        risk,
        trigger: 'Pressure / Humidity / Allergens',
        description: descriptions[risk],
        icon: '👃',
        detailedExplanation: 'The sinus cavities are air-filled spaces that respond directly to changes in barometric pressure. Rapid pressure shifts can cause sinus membranes to swell or contract, leading to pain and congestion. High humidity promotes mucus production, and pollen or cold air irritates the mucosal lining.',
        currentFactors: [
            `Pressure change: ${delta.toFixed(2)} hPa/hour`,
            `Humidity: ${humidity.toFixed(0)}%`,
            `Temperature: ${tempF}°F`,
            ...(pollenMax > 0 ? [`Peak pollen index: ${pollenMax}`] : []),
        ],
        recommendations: [
            'Use a saline rinse to clear irritants and equalise sinus pressure',
            'Stay well hydrated to thin mucus',
            'Avoid rapid temperature transitions (e.g. heated indoors to cold outdoors)',
            'Consider an antihistamine if pollen is elevated',
        ],
    };
}

export function getRaynaudsRisk(temp: number, humidity: number, windMs: number): HealthRisk {
    const tempF = toF(temp);
    const windKph = windMs * 3.6;

    let score = 0;
    if (temp < 15) score += 1;
    if (temp < 10) score += 2;
    if (temp < 5)  score += 2;
    if (temp < 0)  score += 1;
    if (temp < 10 && humidity > 60) score += 1;  // cold + damp compound
    if (temp < 10 && windKph > 20)  score += 1;  // wind chill

    let risk: RiskLevel = 'low';
    if (score >= 6)      risk = 'severe';
    else if (score >= 4) risk = 'high';
    else if (score >= 2) risk = 'moderate';

    const descriptions: Record<RiskLevel, string> = {
        low:      'Temperatures are comfortable for Raynaud\'s — low vasospasm risk.',
        moderate: 'Cooler conditions present. Protect extremities and limit cold exposure.',
        high:     'Cold weather likely to trigger vasospasm in fingers and toes.',
        severe:   'Dangerously cold conditions. Raynaud\'s attack risk is very high — stay warm.',
    };

    return {
        condition: "Raynaud's",
        risk,
        trigger: 'Cold / Wind Chill',
        description: descriptions[risk],
        icon: '🥶',
        detailedExplanation: 'Raynaud\'s phenomenon causes blood vessels in the fingers and toes to over-react to cold or stress, cutting off circulation and causing colour changes, numbness, and pain. Cold temperature, wind chill, and damp conditions are the most reliable triggers.',
        currentFactors: [
            `Temperature: ${tempF}°F`,
            `Humidity: ${humidity.toFixed(0)}%`,
            `Wind: ${windKph.toFixed(0)} km/h`,
        ],
        recommendations: [
            'Wear insulated gloves and warm socks before going outside',
            'Warm up gradually — avoid plunging hands into cold water',
            'Keep your core warm; peripheral circulation depends on core temperature',
            'Carry hand warmers on cold or windy days',
        ],
    };
}

export function getSleepRisk(
    delta1h: number, delta3h: number, delta6h: number,
    temp: number, humidity: number,
    kp: number | null, usAqi: number | null
): HealthRisk {
    const tempF = toF(temp);
    const volatility = Math.abs(delta1h) + Math.abs(delta3h) + Math.abs(delta6h);

    let score = 0;
    if (volatility > 1.5) score += 2;
    if (volatility > 3.0) score += 1;
    if (temp > 24)  score += 1;  // too warm for good sleep
    if (temp > 28)  score += 1;
    if (temp < 12)  score += 1;  // too cold
    if (humidity > 65) score += 1;
    if (kp !== null && kp >= 4) score += 1;   // geomagnetic disrupts melatonin
    if (kp !== null && kp >= 6) score += 1;
    if (usAqi !== null && usAqi > 100) score += 1;

    let risk: RiskLevel = 'low';
    if (score >= 6)      risk = 'severe';
    else if (score >= 4) risk = 'high';
    else if (score >= 2) risk = 'moderate';

    const descriptions: Record<RiskLevel, string> = {
        low:      'Environmental conditions are conducive to good sleep tonight.',
        moderate: 'Some weather factors may lightly disrupt sleep quality or make it harder to fall asleep.',
        high:     'Several environmental stressors are present that commonly interfere with sleep architecture.',
        severe:   'Multiple strong sleep disruptors active — expect difficulty falling or staying asleep.',
    };

    const factors = [
        `Pressure volatility (6h): ${volatility.toFixed(2)}`,
        `Temperature: ${tempF}°F`,
        `Humidity: ${humidity.toFixed(0)}%`,
    ];
    if (kp !== null) factors.push(`Kp index: ${kp.toFixed(1)}`);
    if (usAqi !== null && usAqi > 50) factors.push(`AQI: ${usAqi}`);

    return {
        condition: 'Sleep Quality',
        risk,
        trigger: 'Pressure / Temp / Geomagnetic',
        description: descriptions[risk],
        icon: '🌙',
        detailedExplanation: 'Multiple environmental factors affect sleep quality. Unstable barometric pressure disrupts the body\'s pressure regulation during rest. Room temperature outside the 15–19°C optimal range fragments sleep cycles. High humidity makes thermoregulation harder. Geomagnetic activity suppresses melatonin production, and poor air quality reduces sleep-stage depth.',
        currentFactors: factors,
        recommendations: [
            'Keep your bedroom cool (15–19°C / 60–67°F) if possible',
            'Use blackout curtains and white noise to offset light/sound disruption',
            'Avoid screens 60–90 min before bed on high-Kp nights',
            'On high-volatility pressure nights, avoid late meals and alcohol',
        ],
    };
}

export function getClusterHeadacheRisk(delta1h: number, delta3h: number, delta6h: number, uvIndex: number): HealthRisk {
    // Cluster headaches are triggered specifically by pressure DROPS (not rises)
    // and bright/UV light — different pattern from migraine
    let score = 0;

    if (delta1h < -0.4) score += 2;
    if (delta1h < -0.8) score += 1;
    if (delta3h < -1.5) score += 1;  // sustained drop over 3h
    if (delta6h < -3.0) score += 1;  // significant 6h drop
    if (uvIndex >= 5)   score += 1;  // bright light trigger

    let risk: RiskLevel = 'low';
    if (score >= 5)      risk = 'severe';
    else if (score >= 3) risk = 'high';
    else if (score >= 1) risk = 'moderate';

    const descriptions: Record<RiskLevel, string> = {
        low:      'Pressure is stable — low cluster headache risk from weather today.',
        moderate: 'Mild pressure drop detected. Monitor for early cluster warning signs.',
        high:     'Notable pressure fall — elevated risk of cluster headache onset or cycle break.',
        severe:   'Rapid, sustained pressure drop. High risk period for cluster headache attack.',
    };

    return {
        condition: 'Cluster Headache',
        risk,
        trigger: 'Pressure Drop / UV',
        description: descriptions[risk],
        icon: '⚡',
        detailedExplanation: 'Unlike migraines, cluster headaches are triggered specifically by falling barometric pressure (not rises) and bright light/UV exposure. Rapid pressure drops activate the trigeminal-autonomic pathway, which is the nerve circuit responsible for the intense, one-sided pain and eye/nasal symptoms of cluster attacks. Seasonal shifts in pressure patterns often coincide with cluster periods.',
        currentFactors: [
            `1h pressure change: ${delta1h.toFixed(2)} hPa`,
            `3h pressure change: ${delta3h.toFixed(2)} hPa`,
            `6h pressure change: ${delta6h.toFixed(2)} hPa`,
            `UV index: ${uvIndex}`,
        ],
        recommendations: [
            'At onset: 100% oxygen therapy (if prescribed) is most effective early',
            'Avoid bright light and glare — wear dark glasses outdoors',
            'Keep any prescribed triptans or lidocaine close at hand during high-risk periods',
            'Track pressure patterns alongside your headache diary to identify your personal threshold',
        ],
    };
}

export function getEDSRisk(delta: number, humidity: number, temp: number): HealthRisk {
    const tempF = toF(temp);
    const absD = Math.abs(delta);

    let score = 0;
    if (absD > 0.3) score += 1;
    if (absD > 0.6) score += 1;
    if (temp < 10)  score += 2;  // cold stiffens hypermobile joints
    if (temp < 5)   score += 1;
    if (temp > 26)  score += 1;  // heat increases joint laxity/instability
    if (humidity > 65) score += 1;
    if (humidity > 75) score += 1;
    if (temp < 10 && absD > 0.5) score += 1;  // cold + pressure compound

    let risk: RiskLevel = 'low';
    if (score >= 5)      risk = 'severe';
    else if (score >= 3) risk = 'high';
    else if (score >= 1) risk = 'moderate';

    const descriptions: Record<RiskLevel, string> = {
        low:      'Conditions are relatively stable for connective tissue and joint management.',
        moderate: 'Some weather stress present — joint instability or subluxation risk may be slightly elevated.',
        high:     'Weather conditions are likely to worsen joint laxity, pain, or fatigue in EDS.',
        severe:   'Multiple EDS triggers stacking — high risk of subluxations, flare, or significant fatigue.',
    };

    return {
        condition: 'EDS / Hypermobility',
        risk,
        trigger: 'Cold / Pressure / Heat',
        description: descriptions[risk],
        icon: '🦿',
        detailedExplanation: 'Ehlers-Danlos Syndrome affects collagen and connective tissue throughout the body. Cold temperatures stiffen already-unstable joints, increasing subluxation risk. Heat causes vasodilation and further loosens already-lax ligaments, reducing joint stability. Barometric pressure changes add mechanical stress to joints that lack normal structural support. Humidity compounds both effects.',
        currentFactors: [
            `Temperature: ${tempF}°F`,
            `Humidity: ${humidity.toFixed(0)}%`,
            `Pressure change: ${delta.toFixed(2)} hPa/hour`,
        ],
        recommendations: [
            'Brace or tape unstable joints before activity in cold or high-pressure-change conditions',
            'Warm up very gradually — cold muscles and ligaments are much more injury-prone',
            'In heat, limit standing and activity to reduce laxity-related instability',
            'Use compression garments to support joints during high-risk weather windows',
        ],
    };
}
