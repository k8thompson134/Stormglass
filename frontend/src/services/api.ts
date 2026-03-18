const API_BASE = '/api';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

const getHeaders = (headers: Record<string, string> = {}) => {
  const h: Record<string, string> = { ...headers };
  if (API_TOKEN) {
    h['Authorization'] = `Bearer ${API_TOKEN}`;
  }
  return h;
};

export interface CurrentWeather {
  timestamp: string;
  pressure: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  uvIndex: number;
  cloudCover: number;
  precipitation: number;
  dewPoint: number;
  derivative: {
    delta1h: number;
    delta3h: number;
    delta6h: number;
    trend: 'rising' | 'falling' | 'stable';
  } | null;
  aqi: {
    usAqi: number;
    europeanAqi: number;
    pm25: number;
    pm10: number;
    ozone: number;
    no2: number;
    so2: number;
    co: number;
  } | null;
  geomagnetic: {
    kpIndex: number;
    solarWindSpeed: number;
    solarWindDensity: number;
  } | null;
  pollen: {
    treeIndex: number;
    grassIndex: number;
    weedIndex: number;
    moldIndex: number;
  } | null;
}

export interface WeatherPoint {
  timestamp: string;
  pressure: number;
  temperature: number;
  humidity: number;
  delta1h: number | null;
  trend: 'rising' | 'falling' | 'stable' | null;
  symptomSeverity: number | null;
  usAqi: number | null;
  pm25: number | null;
}

export interface WeatherHistory {
  series: WeatherPoint[];
  count: number;
}

export async function fetchCurrentWeather(): Promise<CurrentWeather> {
  const res = await fetch(`${API_BASE}/weather/current`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch current weather: ${res.status}`);
  return res.json();
}

export async function fetchWeatherHistory(hours: number = 24): Promise<WeatherHistory> {
  const res = await fetch(`${API_BASE}/weather/history?hours=${hours}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch weather history: ${res.status}`);
  return res.json();
}

// Settings
export interface Settings {
  latitude: string;
  longitude: string;
  name: string | null;
}

export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  state: string | null;
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

export async function updateLocation(latitude: string, longitude: string, name?: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/settings/location`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ latitude, longitude, name }),
  });
  if (!res.ok) throw new Error(`Failed to update location: ${res.status}`);
  return res.json();
}

// Symptoms
export interface EnvironmentalSnapshot {
  pressure: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  dewPoint: number;
  uvIndex: number;
  cloudCover: number;
  precipitation: number;
  derivative: {
    delta1h: number;
    delta3h: number;
    delta6h: number;
    trend: 'rising' | 'falling' | 'stable';
  } | null;
  aqi: {
    usAqi: number;
    pm25: number;
    pm10: number;
    ozone: number;
    no2: number;
    so2: number;
    co: number;
  } | null;
  geomagnetic: {
    kpIndex: number;
    solarWindSpeed: number;
    solarWindDensity: number;
  } | null;
  pollen: {
    treeIndex: number;
    grassIndex: number;
    weedIndex: number;
    moldIndex: number;
  } | null;
}

export interface SymptomLogEntry {
  id: string;
  userId: string;
  timestamp: string;
  severity: number;
  tags: string[];
  notes: string | null;
  environmentalSnapshot: EnvironmentalSnapshot | null;
}

export async function createSymptomLog(data: {
  severity: number;
  tags: string[];
  notes?: string;
}): Promise<SymptomLogEntry> {
  const res = await fetch(`${API_BASE}/symptoms`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create symptom log: ${res.status}`);
  return res.json();
}

export async function fetchSymptomLogs(days: number = 30): Promise<SymptomLogEntry[]> {
  const res = await fetch(`${API_BASE}/symptoms?days=${days}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch symptom logs: ${res.status}`);
  const data = await res.json();
  return data.logs;
}

export async function deleteSymptomLog(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/symptoms/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete symptom log: ${res.status}`);
}

export async function geocodeSearch(query: string): Promise<GeoResult[]> {
  const res = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query)}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}
