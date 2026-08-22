# Stormglass API

Base URL: same origin as the frontend (e.g. `http://localhost:3000` in dev). All `/api/*` routes accept optional Bearer token auth when `API_TOKEN` is set in production.

## Authentication

When the server is run with `API_TOKEN` set (required in production), every request to a path under `/api/` must include:

```
Authorization: Bearer <API_TOKEN>
```

- **401 Unauthorized** — Missing or invalid `Authorization` header.
- Health (`/health`) and static file requests are **not** authenticated.

---

## Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check. |

**Response** `200 OK`

```json
{ "status": "ok", "timestamp": "2025-03-04T12:00:00.000Z" }
```

---

### Weather

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/weather/current` | Yes* | Latest weather reading and pressure derivative for the default/location. |
| GET | `/api/weather/history` | Yes* | Time-series of pressure (and related) for charts. |
| GET | `/api/weather/aqi-forecast` | Yes* | 72h AQI/PM2.5 forecast series, safe windows, and next category crossing. |
| GET | `/api/weather/aqi-burden` | Yes* | Cumulative "how bad has the last N days been" AQI summary. |

\*When `API_TOKEN` is set.

#### GET /api/weather/current

**Response** `200 OK` — Current conditions, derivative, AQI, geomagnetic, pollen (or `null` when unavailable).

**Errors**

- **404** — `{ "error": "No weather data available yet" }` (no readings for the configured location).

#### GET /api/weather/history

**Query**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | number | 24 | Window length in hours (capped at 168). |

**Response** `200 OK`

```json
{ "series": [ { "timestamp", "pressure", "temperature", "humidity", "delta1h", "trend", "symptomSeverity", "usAqi", "pm25" }, ... ], "count": N }
```

#### GET /api/weather/aqi-forecast

**Query**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | — | EPA category name (e.g. `Moderate`); takes precedence over `threshold` when valid. |
| `threshold` | number | 100 | US AQI ceiling for "safe" (0-500). |
| `hours` | number | 6 | Chart series window; the underlying safe-window/crossing calc always uses the full 72h forecast regardless of this value. |

**Response** `200 OK`

```json
{ "series": [...], "count": N, "threshold": 100, "safeWindows": [...], "nextSafeWindow": {...} | null, "categoryCrossing": {...} | null }
```

**Errors**

- **404** — `{ "error": "No air quality data available yet" }`.

#### GET /api/weather/aqi-burden

**Query**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 90 | Lookback window (1-365). |
| `threshold` | number | 100 | US AQI ceiling counted as "bad" (0-500). |

**Response** `200 OK` — cumulative burden summary over actual past readings only (never forecast rows).

**Errors**

- **404** — `{ "error": "No air quality history available yet" }`.

---

### Symptoms

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/symptoms` | Yes* | Log a symptom entry with an environmental snapshot attached. |
| GET | `/api/symptoms` | Yes* | List symptom logs (`?days=` window, default 30, max 365). |
| DELETE | `/api/symptoms/:id` | Yes* | Delete a symptom log. |

#### POST /api/symptoms

**Body** (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `severity` | integer (1-10) | Yes | Symptom severity. |
| `tags` | string[] | Yes | Condition tags (see `constants/conditions.ts`). |
| `notes` | string | No | Free-text notes. |

**Response** `201 Created` — the inserted log row, including `environmentalSnapshot`.

**Errors**

- **400** — invalid `severity` or `tags`.
- **503** — `{ "error": "Server not initialized" }` (no location configured yet).

#### GET /api/symptoms

**Response** `200 OK` — `{ "logs": [...] }`, newest first, capped at 500 rows. Returns `{ "logs": [] }` (not an error) before the server has a configured location.

#### DELETE /api/symptoms/:id

**Response** `204 No Content`.

**Errors**

- **404** — `{ "error": "Symptom log not found" }`.
- **503** — `{ "error": "Server not initialized" }`.

---

### Briefing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/briefing` | Yes* | Consolidated snapshot + risk assessment, for external integrations (e.g. lair). |

**Response** `200 OK` — `{ "meta": { timestamp, location, dataAge }, "conditions": { pressure, weather, aqi, ... }, "risks": {...} }`.

---

### Push Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/push/vapid-public-key` | Yes* | Fetch the VAPID public key for `pushManager.subscribe()`. |
| POST | `/api/push/subscribe` | Yes* | Save (or upsert) a browser's push subscription. |
| POST | `/api/push/unsubscribe` | Yes* | Remove a subscription by endpoint. |
| GET | `/api/push/migraine-alerts` | Yes* | Read this device's migraine-alert opt-in. |
| POST | `/api/push/migraine-alerts` | Yes* | Toggle migraine-alert opt-in. |
| GET | `/api/push/mecfs-alerts` | Yes* | Read this device's ME/CFS-alert opt-in. |
| POST | `/api/push/mecfs-alerts` | Yes* | Toggle ME/CFS-alert opt-in. |
| GET | `/api/push/pots-alerts` | Yes* | Read this device's POTS-alert opt-in. |
| POST | `/api/push/pots-alerts` | Yes* | Toggle POTS-alert opt-in. |
| GET | `/api/push/clear-air-alerts` | Yes* | Read this device's clean-air-window opt-in. |
| POST | `/api/push/clear-air-alerts` | Yes* | Toggle clean-air-window opt-in. |
| GET | `/api/push/notification-log` | Yes* | Recent alert decisions (sent/suppressed/failed) for a device, newest first. |

Each secondary alert's GET takes `?endpoint=` and returns `{ "enabled": boolean }`; its POST takes `{ "endpoint", "enabled" }` and returns `{ "ok": true }` (404 if the subscription doesn't exist).

#### POST /api/push/subscribe

**Body** (JSON): `{ "endpoint", "keys": { "p256dh", "auth" } }`.

**Response** `201 Created` — `{ "ok": true }`. Re-subscribing with an existing `endpoint` upserts rather than erroring.

**Errors**

- **400** — missing `endpoint` or `keys`.
- **503** — push not configured on this server, or no user configured yet.

#### POST /api/push/unsubscribe

**Body** (JSON): `{ "endpoint" }`. **Response** `200 OK` — `{ "ok": true }`.

#### GET /api/push/notification-log

**Query**: `?endpoint=`. **Response** `200 OK` — `{ "entries": [...] }`.

**Errors**

- **400** — missing `endpoint`.
- **404** — `{ "error": "Subscription not found" }`.

---

### Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | Yes* | Current location config. |
| POST | `/api/settings/location` | Yes* | Update location and restart weather polling. |
| GET | `/api/geocode` | Yes* | Geocode search (proxy to Open-Meteo). Stricter rate limit: 20 req/min per IP. |

#### GET /api/settings

**Response** `200 OK`

```json
{ "latitude": "40.7128", "longitude": "-74.0060", "name": "City, State, Country" | null }
```

#### POST /api/settings/location

**Body** (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `latitude` | string | Yes | Latitude. |
| `longitude` | string | Yes | Longitude. |
| `name` | string | No | Display name for the location. |
| `timezone` | string | No | IANA zone name (e.g. `America/New_York`); silently ignored if not a valid zone. |

**Response** `200 OK`

```json
{ "success": true, "latitude": "...", "longitude": "...", "name": "..." }
```

**Errors**

- **400** — `{ "error": "latitude and longitude are required" }` or `{ "error": "Invalid coordinates" }`.
- **500** — `{ "error": "Polling not initialized yet" }`.

#### GET /api/geocode

**Query**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search string (min 2 characters). |

**Response** `200 OK`

```json
{ "results": [ { "name", "latitude", "longitude", "country", "state" | null }, ... ] }
```

**Errors**

- **400** — `{ "error": "Query must be at least 2 characters" }`.
- **429** — `{ "error": "Too many geocode requests", "retryAfter": 60 }` (per-IP limit exceeded).
- **500** — `{ "error": "Geocoding failed" }`.
