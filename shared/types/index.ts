// Shared TypeScript types used across frontend and backend

export interface User {
  id: string;
  email: string;
  location: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeatherData {
  id: string;
  userId: string;
  location: string;
  timestamp: Date;
  pressure: number; // hPa
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // m/s
  windDirection: number; // degrees
  uvIndex: number;
  cloudCover: number; // %
  precipitation: number; // mm
  dewPoint: number; // °C
}

export interface PressureDerivative {
  id: string;
  userId: string;
  location: string;
  timestamp: Date;
  delta1h: number; // hPa/hour
  delta3h: number; // hPa/hour
  delta6h: number; // hPa/hour
  trend: 'rising' | 'falling' | 'stable';
}

export interface AirQualityData {
  id: string;
  userId: string;
  location: string;
  timestamp: Date;
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  ozone: number; // ppb
  no2: number; // ppb
  so2: number; // ppb
  co: number; // ppb
  usAqi: number;
  europeanAqi: number;
}

export interface GeomagnticData {
  id: string;
  userId: string;
  timestamp: Date;
  kpIndex: number;
  kpEstimated: number;
  solarWindSpeed: number; // km/s
  solarWindDensity: number; // particles/cm³
}

export interface SymptomLog {
  id: string;
  userId: string;
  timestamp: Date;
  severity: number; // 1-10 scale
  tags: string[];
  notes?: string;
  syncedAt?: Date;
}

export interface UserAlertRule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  type: AlertConditionType;
  operator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';
  value: number;
}

export type AlertConditionType =
  | 'pressure_delta_1h'
  | 'pressure_delta_3h'
  | 'pressure_delta_6h'
  | 'temperature_delta'
  | 'humidity_spike'
  | 'pm25_threshold'
  | 'kp_index_threshold';

export interface AlertHistory {
  id: string;
  userId: string;
  ruleId: string;
  triggeredAt: Date;
  conditionValue: number;
  acknowledged: boolean;
}

export interface CorrelationResult {
  lag: number; // milliseconds (negative = symptom lagged behind environment)
  coefficient: number; // -1 to 1
  pValue: number;
  dataPoints: number;
}

// WebSocket message types
export type WebSocketMessage =
  | { type: 'new_weather_data'; data: WeatherData }
  | { type: 'alert_triggered'; data: AlertHistory }
  | { type: 'sensor_reading'; data: WeatherData }
  | { type: 'ping' };
