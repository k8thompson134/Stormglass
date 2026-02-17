
export type RiskLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface HealthRisk {
    condition: string;
    risk: RiskLevel;
    trigger: string;
    description: string;
    icon: string;
    detailedExplanation: string;
    currentFactors: string[];
    recommendations: string[];
}
