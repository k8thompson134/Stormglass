import type { RiskLevel } from '../types/health';

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
    condition: 'Migraine',
    icon: '🧠',
    triggerLabel: 'Barometric Pressure',
    thresholds: [
        {
            level: 'severe',
            min: 1.5,
            description: 'Extremely rapid pressure change detected. High risk of severe migraine.',
            detailedExplanation: 'Barometric pressure is changing extremely rapidly (>1.5 hPa/hour). This rapid shift causes blood vessels in the brain to expand or contract quickly, triggering the trigeminal nerve which releases inflammatory substances. This cascade effect is a primary trigger for migraine headaches.',
            factors: ['Blood vessel dilation/constriction likely occurring', 'Trigeminal nerve activation probable'],
            recommendations: ['Take preventive medication if prescribed', 'Stay in a dark, quiet room', 'Apply cold compress to forehead', 'Stay well-hydrated']
        },
        {
            level: 'high',
            min: 0.8,
            description: 'Significant pressure shift. Migraine triggers are likely.',
            detailedExplanation: 'Significant barometric pressure changes (0.8-1.5 hPa/hour) can trigger migraines by affecting the pressure differential between the atmosphere and the sinuses/inner ear. This imbalance stimulates nerve endings and can cause vascular changes in the brain.',
            factors: ['Sinus pressure imbalance possible', 'Vascular changes in progress'],
            recommendations: ['Monitor for early warning signs', 'Avoid bright lights and loud noises', 'Consider preventive measures', 'Keep rescue medication accessible']
        },
        {
            level: 'moderate',
            min: 0.4,
            description: 'Moderate pressure instability. Sensitive individuals may feel symptoms.',
            detailedExplanation: 'Moderate pressure changes (0.4-0.8 hPa/hour) may trigger migraines in sensitive individuals. The changing atmospheric pressure affects oxygen levels in the blood and can cause slight swelling of blood vessels in the brain, particularly in those predisposed to migraines.',
            factors: ['Minor vascular changes possible'],
            recommendations: ['Stay hydrated', 'Maintain regular sleep schedule', 'Avoid known dietary triggers']
        },
        {
            level: 'low',
            min: 0,
            description: 'Pressure is stable. Low risk of barometric migraines.',
            detailedExplanation: 'Barometric pressure is stable. When pressure changes are minimal (<0.4 hPa/hour), there is little atmospheric stress on the body. Blood vessels and sinus cavities maintain equilibrium with the environment, reducing migraine triggers.',
            factors: ['Atmospheric conditions favorable'],
            recommendations: ['Good time for outdoor activities', 'Maintain healthy routines']
        }
    ]
};

export const MECFS_CONFIG: RiskConfig = {
    condition: 'ME/CFS / PEM',
    icon: '🔋',
    triggerLabel: 'Atmos. Volatility',
    thresholds: [
        {
            level: 'severe',
            min: 2.5,
            description: 'Extreme atmospheric turbulence. High likelihood of post-exertional malaise flare.',
            detailedExplanation: 'Sustained atmospheric instability places significant stress on the body\'s regulatory systems. For those with ME/CFS or Long COVID, this environmental volatility can trigger post-exertional malaise (PEM) even without physical exertion. The body expends extra energy trying to maintain homeostasis during pressure fluctuations, depleting already limited energy reserves and potentially triggering a crash.',
            factors: ['High metabolic stress from environmental adaptation', 'Energy envelope severely challenged'],
            recommendations: ['Cancel non-essential activities', 'Rest in bed if possible', 'Avoid all physical and cognitive exertion', 'Prepare for potential PEM crash', 'Have support available for basic needs']
        },
        {
            level: 'high',
            min: 1.5,
            description: 'Significant sustained pressure changes. Conserve energy.',
            detailedExplanation: 'Prolonged atmospheric changes require the body to continuously adjust, consuming energy reserves. This sustained stress can lower the threshold for PEM and increase baseline fatigue, brain fog, and other ME/CFS symptoms.',
            factors: ['Increased energy expenditure for homeostasis'],
            recommendations: ['Reduce activity by 50% or more', 'Pace carefully and take frequent breaks', 'Prioritize essential tasks only', 'Monitor for early PEM warning signs']
        },
        {
            level: 'moderate',
            min: 0.8,
            description: 'Moderate instability might increase baseline fatigue.',
            detailedExplanation: 'Moderate atmospheric changes may increase baseline symptoms. While not severe, individuals with ME/CFS may notice increased fatigue, reduced cognitive function, or heightened sensitivity to stimuli.',
            recommendations: ['Pace activities carefully', 'Stay within energy envelope', 'Plan for extra rest periods']
        },
        {
            level: 'low',
            min: 0,
            description: 'Stable environment. Low external risk for PEM crash.',
            detailedExplanation: 'Atmospheric conditions are stable, minimizing environmental stress on the body. This is an optimal time for those with ME/CFS to engage in carefully paced activities within their energy envelope.',
            recommendations: ['Good conditions for paced activities', 'Still respect energy limits']
        }
    ]
};

export const GEOMAGNETIC_CONFIG: RiskConfig = {
    condition: 'Geomagnetic Storm',
    icon: '🧲',
    triggerLabel: 'Kp Index',
    thresholds: [
        {
            level: 'severe',
            min: 7,
            description: 'Severe G3+ storm. High risk of headache and fatigue.',
            detailedExplanation: 'A severe geomagnetic storm (G3 or higher) is occurring. Strong solar activity creates disturbances in Earth\'s magnetic field. Some individuals report increased headaches, migraines, fatigue, sleep disturbances, anxiety, and worsening of chronic pain conditions during these events. The mechanism may involve melatonin disruption, changes in blood pressure, or effects on the nervous system.',
            factors: ['Strong geomagnetic disturbances', 'Melatonin production may be affected', 'Sleep quality may decrease', 'Headache and fatigue triggers present'],
            recommendations: ['Prioritize sleep and rest', 'Reduce screen time before bed', 'Stay hydrated', 'Manage stress levels', 'Track symptoms for patterns']
        },
        {
            level: 'high',
            min: 5,
            description: 'G1 Minor storm. Sensitive individuals may feel effects.',
            detailedExplanation: 'A minor to moderate geomagnetic storm (G1-G2) is occurring. Geomagnetic disturbances can affect sensitive individuals, potentially causing headaches, sleep disruption, mood changes, or increased fatigue. Not everyone is affected, but those who are electromagnetically sensitive may notice symptoms.',
            factors: ['Moderate geomagnetic activity', 'Sleep patterns may be disrupted', 'Sensitive individuals affected'],
            recommendations: ['Monitor sleep quality', 'Maintain regular sleep schedule', 'Note any symptom changes', 'Practice stress reduction']
        },
        {
            level: 'moderate',
            min: 4,
            description: 'Unsettled geomagnetic activity.',
            detailedExplanation: 'Geomagnetic activity is unsettled. While not a full storm, some electromagnetically sensitive individuals may notice mild symptoms such as slight headaches, restlessness, or minor sleep disturbances.',
            factors: ['Mild geomagnetic disturbances'],
            recommendations: ['Monitor for symptoms', 'Maintain healthy sleep habits']
        },
        {
            level: 'low',
            min: 0,
            description: 'Geomagnetic field is quiet.',
            detailedExplanation: 'Geomagnetic conditions are quiet and stable. Solar activity is low, and Earth\'s magnetic field is calm. This minimizes any potential effects on sensitive individuals.',
            factors: ['Stable geomagnetic field', 'Minimal electromagnetic disturbances'],
            recommendations: ['Normal conditions for all activities', 'Good time for restorative sleep']
        }
    ]
};

export const AQI_CONFIG: RiskConfig = {
    condition: 'Air Quality',
    icon: '🌫️',
    triggerLabel: 'US AQI',
    thresholds: [
        {
            level: 'severe',
            min: 200,
            description: 'Health alert: increased risk of health effects for everyone.',
            detailedExplanation: 'Air quality is very unhealthy. High levels of particulate matter (PM2.5, PM10) and pollutants can trigger respiratory distress, worsen asthma and COPD, increase cardiovascular strain, trigger migraines, and cause systemic inflammation. Everyone, especially those with chronic conditions, is at risk.',
            recommendations: ['Stay indoors with windows closed', 'Use air purifiers if available', 'Avoid all outdoor physical activity', 'Use N95 masks if must go outside', 'Monitor symptoms closely']
        },
        {
            level: 'high',
            min: 150,
            description: 'Unhealthy. Sensitive groups should avoid outdoor exertion.',
            detailedExplanation: 'Air quality is unhealthy. Particulate matter and pollutants can aggravate respiratory conditions, trigger asthma attacks, worsen cardiovascular symptoms, and increase inflammation. Sensitive individuals (children, elderly, those with chronic conditions) are at significant risk.',
            recommendations: ['Limit outdoor activities', 'Keep rescue inhalers accessible', 'Close windows, run air filtration', 'Sensitive groups stay indoors']
        },
        {
            level: 'moderate',
            min: 100,
            description: 'Moderate. Acceptable for most, but risk for sensitive groups.',
            detailedExplanation: 'Air quality is moderate. While acceptable for most people, those with respiratory conditions, cardiovascular disease, or heightened sensitivity may experience mild symptoms such as coughing, shortness of breath, or fatigue.',
            recommendations: ['Sensitive groups limit prolonged outdoor exertion', 'Monitor symptoms', 'Consider indoor exercise alternatives']
        },
        {
            level: 'low',
            min: 51,
            description: 'Moderate range — generally acceptable for most people.',
            detailedExplanation: 'Air quality is in the moderate-to-good range. Most people will not be affected. However, those unusually sensitive to air pollution may experience minor symptoms like mild irritation.',
            recommendations: ['Safe for most outdoor activities', 'Unusually sensitive individuals may want to limit prolonged exertion']
        },
        {
            level: 'low',
            min: 0,
            description: 'Air quality is satisfactory.',
            detailedExplanation: 'Air quality is good. Low levels of pollutants pose little to no risk to health. This is optimal for outdoor activities and respiratory health.',
            recommendations: ['Good conditions for outdoor activities', 'Enjoy fresh air safely']

        }
    ]
};

// ... (POTS and JointPain are complex/multi-factor, might keep as functions or add complex config later)
