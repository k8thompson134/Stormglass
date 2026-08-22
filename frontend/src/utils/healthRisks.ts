import type { RiskLevel } from "../types/health";

export interface RiskThreshold {
  level: RiskLevel;
  min?: number;
  max?: number;
  description: string;
  detailedExplanation: string;
  factors?: string[];
  recommendations?: string[];
}

export interface RiskConfig {
  condition: string;
  icon: string;
  triggerLabel: string;
  defaultExplanation?: string;
  thresholds: RiskThreshold[];
}

export const MIGRAINE_CONFIG: RiskConfig = {
  condition: "Migraine",
  icon: "🧠",
  triggerLabel: "Barometric Pressure",
  thresholds: [
    {
      level: "severe",
      min: 1.5,
      description:
        "Extreme, fast pressure swings. Very high chance of barometric migraine for sensitive people.",
      detailedExplanation:
        "Barometric pressure is changing extremely quickly (>1.5 hPa/hour). Rapid shifts in outside pressure can change pressure in the sinuses and around blood vessels in the brain. In people prone to migraines this can activate pain pathways (including the trigeminal nerve) and trigger a severe attack.",
      factors: [
        "Very rapid change in barometric pressure",
        "Strong stimulus to migraine-sensitive pain pathways",
      ],
      recommendations: [
        "Use any prescribed preventive or rescue medication early",
        "Reduce light, noise, and screen exposure",
        "Rest in a quiet space if possible",
        "Stay well-hydrated and avoid skipping meals",
      ],
    },
    {
      level: "high",
      min: 0.8,
      description:
        "Large pressure shift. Migraine risk is elevated, especially if you are weather-sensitive.",
      detailedExplanation:
        "Significant barometric changes (around 0.8–1.5 hPa/hour) can disturb the balance between outside pressure and pressure in the sinuses and inner ear. This can stress blood vessels and nerves in the head and raise the chance of a migraine if you are pressure-sensitive.",
      factors: [
        "Noticeable barometric pressure swing",
        "Sinus and inner-ear pressure likely changing",
      ],
      recommendations: [
        "Watch for early migraine warning signs",
        "Limit bright light and loud environments",
        "Keep rescue medication close at hand",
        "Prioritize rest and regular hydration",
      ],
    },
    {
      level: "moderate",
      min: 0.4,
      description:
        "Moderate pressure instability. Migraine risk is mild but present for sensitive individuals.",
      detailedExplanation:
        "Moderate pressure changes (about 0.4–0.8 hPa/hour) are enough to bother some migraine-prone people, even if most others feel fine. Small shifts in vessel size and sinus pressure can tip you toward a headache when combined with other triggers like poor sleep or stress.",
      factors: ["Ongoing but moderate change in barometric pressure"],
      recommendations: [
        "Stay hydrated and eat regularly",
        "Maintain a consistent sleep schedule",
        "Avoid your known personal migraine triggers where possible",
      ],
    },
    {
      level: "low",
      min: 0,
      description:
        "Pressure is stable. Low risk of barometric migraine from current conditions.",
      detailedExplanation:
        "Barometric pressure is changing very little (<0.4 hPa/hour), so there is minimal environmental stress from pressure itself. This reduces the chance that weather alone will trigger a migraine, though other personal triggers may still matter.",
      factors: [
        "Stable barometric pressure",
        "Minimal pressure-related stress on the body",
      ],
      recommendations: [
        "Good conditions for normal activities",
        "Continue usual migraine prevention habits",
      ],
    },
  ],
};

export const MECFS_CONFIG: RiskConfig = {
  condition: "ME/CFS / PEM",
  icon: "🔋",
  triggerLabel: "Atmos. Volatility",
  thresholds: [
    {
      level: "severe",
      min: 2.5,
      description:
        "Extreme atmospheric volatility. Very high risk of symptom flare or PEM for sensitive individuals.",
      detailedExplanation:
        "Strong, sustained swings in pressure create ongoing work for the body to keep temperature, blood pressure, and circulation stable. For people with ME/CFS or Long COVID, this extra load can quickly exceed limited energy reserves and trigger a significant flare or post‑exertional malaise, even without extra activity.",
      factors: [
        "Heavy regulatory stress from unstable pressure",
        "Energy envelope under severe strain",
      ],
      recommendations: [
        "Cancel non‑essential plans and rest as much as possible",
        "Avoid both physical and cognitive overexertion",
        "Prepare support for meals and basic needs if available",
        "Use any pacing or PEM‑prevention strategies that work for you",
      ],
    },
    {
      level: "high",
      min: 1.5,
      description:
        "Strong, sustained pressure changes. Symptoms may worsen unless you conserve energy.",
      detailedExplanation:
        "Prolonged atmospheric instability forces the body to keep adjusting circulation and fluid balance. For ME/CFS or Long COVID, this can raise baseline fatigue, brain fog, and pain, and lower the threshold for PEM.",
      factors: [
        "Ongoing pressure volatility increasing energy use",
        "Lowered margin for activity before symptoms flare",
      ],
      recommendations: [
        "Scale back activity significantly (for example by ~50%)",
        "Prioritize only essential tasks and add extra rest breaks",
        "Monitor closely for early PEM warning signs and respond quickly",
      ],
    },
    {
      level: "moderate",
      min: 0.8,
      description:
        "Moderate instability. Some increase in fatigue or sensitivity is possible.",
      detailedExplanation:
        "Moderate atmospheric changes can gently raise background load on the body. People with ME/CFS or Long COVID may notice a little more fatigue, brain fog, or sensory sensitivity than usual.",
      recommendations: [
        "Pace activities a bit more conservatively",
        "Stay within your usual energy envelope",
        "Plan a little extra rest into the day",
      ],
    },
    {
      level: "low",
      min: 0,
      description:
        "Stable environment. Weather is unlikely to drive PEM on its own.",
      detailedExplanation:
        "Pressure is relatively steady, so there is little extra stress from the weather itself. This is a better time to do gently paced activity within your normal limits, while still respecting your energy boundaries.",
      recommendations: [
        "Good conditions for carefully paced activity",
        "Continue listening to your body and avoid overexertion",
      ],
    },
  ],
};

export const GEOMAGNETIC_CONFIG: RiskConfig = {
  condition: "Geomagnetic Storm",
  icon: "🧲",
  triggerLabel: "Kp Index",
  thresholds: [
    {
      level: "severe",
      min: 7,
      description:
        "Severe geomagnetic storm. Sensitive individuals may have strong headache, fatigue, or sleep disruption.",
      detailedExplanation:
        "A strong geomagnetic storm (G3 or higher) is disturbing Earth’s magnetic field. Some people report more headaches, fatigue, poor sleep, or mood changes during these events. Possible reasons include changes in melatonin, blood pressure, or how the nervous system responds to magnetic shifts.",
      factors: [
        "Strong disturbance in Earth’s magnetic field",
        "Higher chance of disrupted sleep and nervous system irritation",
      ],
      recommendations: [
        "Prioritize good sleep routines and wind‑down time",
        "Reduce evening screen exposure if you are sensitive",
        "Stay hydrated and manage stress as well as you can",
        "Note any symptom patterns you see during strong storms",
      ],
    },
    {
      level: "high",
      min: 5,
      description:
        "Minor to moderate storm. Sensitive individuals may notice symptoms.",
      detailedExplanation:
        "A minor to moderate geomagnetic storm (G1–G2) is in progress. Many people feel nothing, but those who are sensitive may experience headaches, lighter sleep, or more fatigue than usual.",
      factors: ["Moderate geomagnetic activity above quiet background levels"],
      recommendations: [
        "Maintain a steady sleep schedule",
        "Use relaxing evening routines if you struggle with sleep",
        "Pay attention to any repeatable patterns with your symptoms",
      ],
    },
    {
      level: "moderate",
      min: 4,
      description:
        "Unsettled geomagnetic activity. Mild effects are possible in very sensitive people.",
      detailedExplanation:
        "The geomagnetic field is more active than usual but not in a full storm state. A small subset of very sensitive people may notice mild headaches, restlessness, or trouble falling asleep.",
      factors: ["Slightly elevated geomagnetic activity"],
      recommendations: [
        "Keep general sleep and stress‑management habits in place",
        "Notice but do not over‑interpret minor changes in how you feel",
      ],
    },
    {
      level: "low",
      min: 0,
      description: "Geomagnetic field is quiet and stable.",
      detailedExplanation:
        "Solar and geomagnetic activity are low, so the magnetic environment around Earth is calm. This minimizes any potential impact on headache, sleep, or mood for sensitive individuals.",
      factors: ["Stable geomagnetic field with minimal disturbance"],
      recommendations: [
        "Normal conditions for daily activity",
        "Good backdrop for restorative sleep routines",
      ],
    },
  ],
};

export const AQI_CONFIG: RiskConfig = {
  condition: "Air Quality",
  icon: "🌫️",
  triggerLabel: "US AQI",
  thresholds: [
    {
      level: "severe",
      min: 201,
      description:
        "Very unhealthy to hazardous air. Everyone is at increased risk of symptoms or flare‑ups.",
      detailedExplanation:
        'Air quality is very poor to hazardous (US AQI 201+, EPA "Very Unhealthy"/"Hazardous"). High levels of fine particles and gases can irritate the lungs and airways, strain the heart and blood vessels, and trigger headaches or fatigue. People with asthma, COPD, heart disease, or migraine are especially vulnerable, but even healthy people may feel effects — and above US AQI 300 (Hazardous), the entire population is at risk.',
      recommendations: [
        "Seal up windows and doors — tape or a towel over gaps helps if you can smell smoke inside",
        "Run a HEPA air purifier, or a box fan with a furnace filter taped to it",
        "Skip outdoor exercise entirely — even brief exposure raises symptom risk at this level",
        "Wear a well‑fitting N95 outside — check the seal around your nose, a loose fit lets smoke through",
        "Not improving, or have a heart or lung condition? Treat it as a cue to relocate rather than wait it out",
        "Monitor your symptoms and follow any action plans from your clinician",
      ],
    },
    {
      level: "high",
      min: 151,
      description:
        "Unhealthy air. Sensitive groups should limit outdoor time and exertion.",
      detailedExplanation:
        'Air quality is unhealthy (US AQI 151–200, EPA "Unhealthy"). Pollutants and fine particles can aggravate asthma, COPD, and heart conditions, and may trigger headaches or fatigue in sensitive people.',
      recommendations: [
        "Limit time spent outdoors, especially for exercise",
        "Keep windows closed and run an air purifier if you have one",
        "Wear a well‑fitting N95 if you'll be outside more than a few minutes",
        "Ensure rescue inhalers or other medications are accessible",
        "Children, older adults, and people with chronic conditions should stay indoors when possible",
      ],
    },
    {
      level: "moderate",
      min: 101,
      description:
        "Air quality is acceptable for most, but sensitive people may feel mild effects.",
      detailedExplanation:
        'US AQI 101–150 is EPA "Unhealthy for Sensitive Groups." Most people can be active outside, but those with respiratory or heart conditions may notice coughing, shortness of breath, or tiredness sooner than usual.',
      recommendations: [
        "Sensitive groups should limit long or intense outdoor exertion",
        "Monitor your breathing and energy; ease up if symptoms appear",
        "Consider moving strenuous exercise indoors",
      ],
    },
    {
      level: "low",
      min: 51,
      description:
        "Slightly elevated pollution. Generally fine, with only mild risk for unusually sensitive people.",
      detailedExplanation:
        'Air quality is in the EPA "Moderate" band (US AQI 51–100). Most people will not notice any effect, but those who are very sensitive to pollution may feel mild irritation or discomfort during long outdoor activities.',
      recommendations: [
        "Safe for most outdoor activities",
        "If you are very sensitive, consider shortening or spacing out intense outdoor exercise",
      ],
    },
    {
      level: "low",
      min: 0,
      description: "Air quality is good.",
      detailedExplanation:
        "Pollution levels are low. This is an ideal backdrop for outdoor activity and for people with breathing‑related conditions.",
      recommendations: [
        "Excellent conditions for most outdoor activities",
        "Good time for movement and fresh air if you feel up to it",
      ],
    },
  ],
};

// ... (POTS and JointPain are complex/multi-factor, might keep as functions or add complex config later)
