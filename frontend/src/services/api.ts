const API_BASE = "/api";
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

const getHeaders = (headers: Record<string, string> = {}) => {
  const h: Record<string, string> = { ...headers };
  if (API_TOKEN) {
    h["Authorization"] = `Bearer ${API_TOKEN}`;
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
    trend: "rising" | "falling" | "stable";
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
    hyperlocal: {
      usAqi: number;
      pm25: number;
      sensorCount: number;
      nearestMiles: number;
    } | null;
    smokeTrend: {
      direction: "worsening" | "improving" | "stable";
      currentPm25: number;
      next24hPeakPm25: number;
      next24hPeakUsAqi: number;
      next24hPeakAt: string | null;
      likelyWildfireSmoke: boolean;
    } | null;
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
  trend: "rising" | "falling" | "stable" | null;
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
    headers: getHeaders(),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch current weather: ${res.status}`);
  return res.json();
}

export async function fetchWeatherHistory(
  hours: number = 24,
): Promise<WeatherHistory> {
  const res = await fetch(`${API_BASE}/weather/history?hours=${hours}`, {
    headers: getHeaders(),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch weather history: ${res.status}`);
  return res.json();
}

// Fixed 7-day trailing average pressure, independent of whatever range the
// pressure chart currently has selected -- keeps storm-severity scoring stable
// across zoom levels instead of scoring the same storm differently at 6h vs 7d.
export async function fetchPressureBaseline(): Promise<{
  avgPressure: number | null;
}> {
  const res = await fetch(`${API_BASE}/weather/pressure-baseline`, {
    headers: getHeaders(),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch pressure baseline: ${res.status}`);
  return res.json();
}

export interface AQIForecastPoint {
  timestamp: string;
  usAqi: number;
  pm25: number;
  pm10: number;
}

export interface AQISafeWindow {
  start: string;
  end: string;
  durationHours: number;
  avgAqi: number;
  maxAqi: number;
  isCurrent: boolean;
}

export type AqiCategory =
  | "Good"
  | "Moderate"
  | "Unhealthy for Sensitive Groups"
  | "Unhealthy"
  | "Very Unhealthy"
  | "Hazardous";

export interface AQICategoryCrossing {
  fromCategory: AqiCategory;
  toCategory: AqiCategory;
  at: string;
  usAqi: number;
}

export interface AQIForecast {
  series: AQIForecastPoint[];
  count: number;
  threshold: number;
  safeWindows: AQISafeWindow[];
  nextSafeWindow: AQISafeWindow | null;
  categoryCrossing: AQICategoryCrossing | null;
}

export async function fetchAQIForecast(
  hours?: number,
  threshold?: number,
): Promise<AQIForecast | null> {
  const params = new URLSearchParams();
  if (hours !== undefined) params.set("hours", String(hours));
  if (threshold !== undefined) params.set("threshold", String(threshold));
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/weather/aqi-forecast${query}`, {
    headers: getHeaders(),
  });
  if (res.status === 404) return null; // no AQI data yet -- not an error state
  if (!res.ok) throw new Error(`Failed to fetch AQI forecast: ${res.status}`);
  return res.json();
}

export interface AQIBurdenSummary {
  days: number;
  threshold: number;
  totalDaysTracked: number;
  daysAtOrAboveThreshold: number;
  byCategory: Record<AqiCategory, number>;
  dailyMax: { date: string; maxAqi: number }[];
}

export async function fetchAQIBurden(
  days?: number,
  threshold?: number,
): Promise<AQIBurdenSummary | null> {
  const params = new URLSearchParams();
  if (days !== undefined) params.set("days", String(days));
  if (threshold !== undefined) params.set("threshold", String(threshold));
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/weather/aqi-burden${query}`, {
    headers: getHeaders(),
  });
  if (res.status === 404) return null; // no history yet -- not an error state
  if (!res.ok)
    throw new Error(`Failed to fetch AQI burden summary: ${res.status}`);
  return res.json();
}

// Settings
export interface LocationSettings {
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
  timezone: string | null;
}

export async function fetchSettings(): Promise<LocationSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

export async function updateLocation(
  latitude: string,
  longitude: string,
  name?: string,
  timezone?: string,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/settings/location`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ latitude, longitude, name, timezone }),
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
    trend: "rising" | "falling" | "stable";
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
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create symptom log: ${res.status}`);
  return res.json();
}

export async function fetchSymptomLogs(
  days: number = 30,
): Promise<SymptomLogEntry[]> {
  const res = await fetch(`${API_BASE}/symptoms?days=${days}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch symptom logs: ${res.status}`);
  const data = await res.json();
  return data.logs;
}

export async function deleteSymptomLog(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/symptoms/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete symptom log: ${res.status}`);
}

export async function exportSymptomLogs(
  days: number = 365,
): Promise<SymptomLogEntry[]> {
  return fetchSymptomLogs(days);
}

export async function geocodeSearch(query: string): Promise<GeoResult[]> {
  const res = await fetch(
    `${API_BASE}/geocode?q=${encodeURIComponent(query)}`,
    {
      headers: getHeaders(),
    },
  );
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}

// --- Push notifications ---

// null (not thrown) when the server has no VAPID keys configured -- that's a
// legitimate "feature not available here" state, not a fetch error.
export async function fetchPushPublicKey(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`, {
    headers: getHeaders(),
  });
  if (res.status === 503) return null;
  if (!res.ok) throw new Error(`Fetch push public key failed: ${res.status}`);
  const data = await res.json();
  return data.publicKey;
}

export async function subscribeToPush(
  subscription: PushSubscriptionJSON,
): Promise<void> {
  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error(`Push subscribe failed: ${res.status}`);
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  const res = await fetch(`${API_BASE}/push/unsubscribe`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error(`Push unsubscribe failed: ${res.status}`);
}

// migraine/mecfs/pots/clear-air alerts are each a distinct opt-in from the main
// AQI toggle, but share the exact same read/toggle shape server-side
// (registerAlertToggleRoutes in backend/src/api/push.ts) -- one parameterized pair
// here instead of four hand-copied ones.
export type SecondaryAlertKind =
  | "migraine"
  | "mecfs"
  | "pots"
  | "clear-air"
  | "sinus"
  | "cluster"
  | "fibromyalgia";

const SECONDARY_ALERT_PATH: Record<SecondaryAlertKind, string> = {
  migraine: "migraine-alerts",
  mecfs: "mecfs-alerts",
  pots: "pots-alerts",
  "clear-air": "clear-air-alerts",
  sinus: "sinus-alerts",
  cluster: "cluster-alerts",
  fibromyalgia: "fibromyalgia-alerts",
};

export async function fetchSecondaryAlertEnabled(
  kind: SecondaryAlertKind,
  endpoint: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/push/${SECONDARY_ALERT_PATH[kind]}?endpoint=${encodeURIComponent(endpoint)}`,
    {
      headers: getHeaders(),
    },
  );
  if (!res.ok)
    throw new Error(`Fetch ${kind} alert setting failed: ${res.status}`);
  const data = await res.json();
  return data.enabled;
}

export async function setSecondaryAlertEnabled(
  kind: SecondaryAlertKind,
  endpoint: string,
  enabled: boolean,
): Promise<void> {
  const res = await fetch(`${API_BASE}/push/${SECONDARY_ALERT_PATH[kind]}`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ endpoint, enabled }),
  });
  if (!res.ok)
    throw new Error(`Set ${kind} alert setting failed: ${res.status}`);
}

export interface PushNotificationLogEntry {
  type:
    | "aqi"
    | "aqi_current"
    | "migraine"
    | "mecfs"
    | "pots"
    | "sinus"
    | "cluster"
    | "fibromyalgia"
    | "clear_air"
    | "welcome";
  outcome: "sent" | "suppressed_dedup" | "delivery_failed";
  title: string;
  body: string;
  eventAt: string | null;
  createdAt: string;
}

export async function fetchNotificationLog(
  endpoint: string,
): Promise<PushNotificationLogEntry[]> {
  const res = await fetch(
    `${API_BASE}/push/notification-log?endpoint=${encodeURIComponent(endpoint)}`,
    {
      headers: getHeaders(),
    },
  );
  if (!res.ok) throw new Error(`Fetch notification log failed: ${res.status}`);
  const data = await res.json();
  return data.entries;
}
