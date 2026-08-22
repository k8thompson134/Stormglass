# Stormglass System Design

## High-Level Architecture

```
┌─────────────────┐
│   React PWA     │  (Frontend - Vite + TypeScript)
│   + Workbox     │
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼────────────────────────┐
│   Fastify Server (Node.js)       │
│  ┌──────────────────────────┐   │
│  │ REST API                 │   │
│  │ WebSocket Handler        │   │
│  └──────────────────────────┘   │
│                                 │
│  Scheduled Jobs (Cron):         │
│  - API polling per user         │
│  - Derivative computation       │
└────────┬────────────────────────┘
         │
┌────────▼────────┐
│ PostgreSQL      │
│ (Drizzle ORM)   │
└─────────────────┘
```

## Data Flow

### 1. Weather Data Ingestion
- **Trigger**: Scheduled cron job (every 30 minutes per user location)
- **Sources**: Open-Meteo (weather + AQI), NOAA (geomagnetic), Tomorrow.io (pollen, optional)
- **Storage**: weather_data, air_quality_data, geomagnetic_data, pollen_data tables
- **Compute**: Pressure derivatives (1h, 3h, 6h rolling windows)

### 2. Health Impact Evaluation
- **Trigger**: Frontend loads current data from API
- **Engine**: Client-side risk evaluation across 7 health conditions
- **Conditions**: Migraine, POTS, ME/CFS, joint pain, air quality, geomagnetic, pollen
- **Output**: Risk levels (low/moderate/high/severe) with explanations and recommendations

## Database Schema (Key Tables)

### Users
- id, email, location, timezone, created_at, updated_at

### WeatherData
- id, user_id, location, timestamp, pressure, temperature, humidity, wind_speed, etc.
- Indexes: (user_id, timestamp), (location, timestamp)

### PressureDerivatives
- id, user_id, location, timestamp, delta_1h, delta_3h, delta_6h, trend
- Pre-computed at ingest time for fast queries

### AirQualityData
- id, user_id, location, timestamp, pm25, pm10, ozone, no2, so2, co, us_aqi, european_aqi

### GeomagneticData
- id, user_id, timestamp, kp_index, kp_estimated, solar_wind_speed, solar_wind_density

### PollenData
- id, user_id, location, timestamp, tree_index, grass_index, weed_index, mold_index

## API Endpoints

```
GET  /api/weather/current          - Latest conditions + derivatives + AQI + geomagnetic + pollen
GET  /api/weather/history?hours=N  - Time-series data for charts (capped at 168h)
GET  /api/settings                 - Current location config
POST /api/settings/location        - Update location and restart polling
GET  /api/geocode?q=city           - Geocode search (proxy to Open-Meteo)
GET  /health                       - Liveness check
```

## Key Algorithms

### Pressure Derivative Computation
```
For each 1-hour, 3-hour, 6-hour window:
  delta = (latest_pressure - oldest_pressure) / window_hours
```

## Scalability Considerations

### Current Target
- ~200 users at 30-minute polling intervals
- Open-Meteo free tier: 10,000 calls/day
- Per-user quota: 10,000 / (200 * 3 endpoints * 48 calls/day) — feasible

### Storage
- ~3 MB/user/month all sources combined
- 100 users x 12 months = 3.6 GB easily fits on basic PostgreSQL

## Security & Data Privacy

1. **HTTPS/TLS** for all transmissions
2. **Location-based queries** only — no user tracking beyond their entered location
3. **API token auth** in production — all `/api/*` routes require Bearer token
4. **Rate limiting** on all routes, stricter limits on geocoding proxy
