# Stormglass API

Base URL: same origin as the frontend (e.g. `http://localhost:3000` in dev). All `/api/*` routes accept optional Bearer token auth when `API_TOKEN` is set in production.

## Authentication

When the server is run with `API_TOKEN` set (required in production), every request to a path under `/api/` must include:

```
Authorization: Bearer <API_TOKEN>
```

- **401 Unauthorized** — Missing or invalid `Authorization` header.
- Health (`/health`), WebSocket (`/ws`), and static file requests are **not** authenticated.

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

---

## WebSocket

| Path | Auth | Description |
|------|------|-------------|
| GET /ws | No | WebSocket upgrade. **Public**; do not send user-specific or sensitive data. |

Message handling is currently echo-style.
