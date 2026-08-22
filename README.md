# Stormglass

A progressive web app that tracks environmental conditions, logs symptoms, and reveals personal health patterns. Built for people with chronic conditions (migraines, ME/CFS, Long COVID, POTS, fibromyalgia, EDS, Raynaud's, and more) where environmental factors trigger symptom flares.

## Features

- **Environmental tracking** — Real-time pressure, temperature, humidity, wind, UV, cloud cover, precipitation with trend indicators
- **Pressure dynamics chart** with rate-of-change visualization, forecast overlay, volatile zone highlighting, and front passage detection
- **Air quality & wildfire smoke tracking** — Regional AQI forecast blended with hyperlocal PurpleAir ground sensors, smoke trend detection, upcoming safe-air windows, category-crossing alerts, and exposure-burden tracking over time
- **Personalized daily risk forecast** showing condition-specific risk levels with recommendations, including AQI as a contributing factor for migraine, ME/CFS, POTS, joint pain, fibromyalgia, and sinus pressure
- **Symptom logger** — Log symptoms with severity levels and environmental snapshots automatically captured
- **Trends & patterns analysis** — Personalized condition-specific trigger identification showing which environmental factors correlate with your symptoms
- **Configurable health conditions** — Choose which conditions to track in daily forecasts
- **Location search** via geocoding, with per-location timezone — Set your location for accurate local weather and correctly-grouped daily summaries
- **Mobile-optimized responsive design** with accessibility improvements, reachable over Tailscale/LAN in dev
- **PWA with offline support** via Workbox

## How It Works

### Daily Risk Forecast
Shows personalized risk levels for each of your tracked conditions based on current and forecast environmental data. Each condition has specific trigger factors (pressure change, geomagnetic activity, humidity, air quality, pollen).

### Air Quality & Wildfire Smoke
Air quality combines a regional model (~7 mile grid) with real nearby PurpleAir ground sensors when at least a few are close by — whichever reading is higher drives the risk score and the on-screen number, so a nearby smoke plume the regional model misses still shows up. Fewer than 3 nearby sensors is flagged as lower confidence. The forecast chart detects worsening/improving smoke trends, surfaces upcoming windows where air quality is expected to stay safe, and tracks how many days recently have been at or above your threshold.

### Symptom Logging
Log symptoms with severity (1-10) and condition tags. The app automatically captures the environmental snapshot at the time of logging — pressure, temperature, humidity, air quality, geomagnetic data, and more.

### Trends & Patterns Analysis
Analyzes your symptom history to identify which environmental factors correlate with your specific conditions. Shows:
- **Condition-specific triggers** ranked by severity impact
- **Trend charts** visualizing symptom severity over time
- **Recovery factors** highlighting what improves your symptoms
- **Dangerous combinations** warning when multiple high-risk factors align
- **Actionable insights** based on your personal data

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Recharts, Tailwind CSS, Workbox PWA
- **Backend:** Node.js, Fastify 5, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Monorepo** with shared types package (`@stormglass/shared`)
- **Testing:** Vitest (backend), with route-level integration tests via Fastify's `.inject()`

## Data Sources

| Source | Data | Notes |
|--------|------|-------|
| **Open-Meteo** | Hourly pressure, temperature, humidity, wind, UV, cloud cover, precipitation | Free, no API key |
| **Open-Meteo Air Quality** | PM2.5, PM10, ozone, NO2, SO2, CO, US/European AQI, 3-day forecast | Free, no API key |
| **PurpleAir** *(optional)* | Hyperlocal ground-sensor AQI, EPA-corrected, nearest 3 sensors averaged | Requires free API key; points-based rate limit, so responses are cached 60 min |
| **NOAA Space Weather** | Kp index, solar wind speed/density | Free, no API key |
| **Tomorrow.io** *(optional)* | Tree, grass, weed, mold pollen indices | Requires API key; skipped if unset |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16+

### Setup

```bash
# Install all workspace dependencies
npm install

# Copy and edit environment config
cp .env.example .env
# Set DATABASE_URL at minimum (e.g. postgresql://user:pass@localhost:5432/stormglass)
# PURPLEAIR_API_KEY and TOMORROW_API_KEY are optional — those features degrade
# gracefully (fall back to the regional model / skip pollen) if left unset.

# Run database migrations and seed default user
npm run db:migrate
npm run db:seed

# Start both frontend and backend in dev mode
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend on port 3000 (override with `BACKEND_PORT`). Set `host: true` in `vite.config.ts` (already the default) plus an `allowedHosts` entry to reach the dev server from another device over Tailscale/LAN.

### Tests

```bash
npm test
```

## Project Structure

```
stormglass/
├── frontend/           # React 18 + Vite PWA
│   └── src/
│       ├── components/ # UI components:
│       │   ├── PressureChart.tsx     # Pressure dynamics visualization
│       │   ├── AQIForecastChart.tsx  # Air quality forecast + smoke trend chart
│       │   ├── AQISeasonSummary.tsx  # Rolling exposure-burden summary
│       │   ├── HealthImpact.tsx      # Risk forecast cards with personalized data
│       │   ├── CurrentConditions.tsx # Real-time environmental conditions
│       │   ├── SymptomLogger.tsx     # Symptom logging modal with environment capture
│       │   ├── TrendsModal.tsx       # Trends entry point (wraps Insights.tsx)
│       │   ├── Insights.tsx          # Condition-specific trigger analysis and trends
│       │   ├── Info.tsx              # About / data sources / privacy modal
│       │   └── Settings.tsx          # Location + health condition preferences
│       ├── services/   # API client (fetchSymptomLogs, fetchCurrentWeather, fetchAQIForecast, etc)
│       ├── utils/       # Health risk evaluation logic
│       └── App.tsx     # Main layout and data orchestration
│
├── backend/            # Node.js + Fastify
│   └── src/
│       ├── api/        # Route handlers:
│       │   ├── weather.ts      # Environmental + AQI forecast/burden endpoints
│       │   ├── briefing.ts     # Combined daily risk briefing endpoint
│       │   ├── settings.ts     # User preferences (location, timezone)
│       │   └── symptoms.ts     # Symptom log CRUD
│       ├── services/   # Data fetching (Open-Meteo, PurpleAir, NOAA, Tomorrow.io)
│       ├── utils/       # smoke.ts, aqiWindows.ts, aqiBurden.ts, healthLogic.ts
│       ├── db/          # Drizzle schema and migrations
│       ├── jobs/        # Cron scheduler (weather polling every 30 min)
│       └── server.ts   # Fastify app setup
│
├── shared/             # Shared TypeScript types and utilities
├── docker-compose.yml  # PostgreSQL setup for local dev
├── .env.example        # Environment variable template
└── package.json        # Monorepo workspace config
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No (3000) | Backend listen port |
| `HOST` | No (0.0.0.0) | Backend listen host |
| `DEFAULT_LATITUDE` | No (40.7128) | Default polling location latitude (only used to seed the first-ever user; location is persisted after) |
| `DEFAULT_LONGITUDE` | No (-74.0060) | Default polling location longitude |
| `DEFAULT_TIMEZONE` | No (America/New_York) | Default timezone for the first-ever user |
| `TOMORROW_API_KEY` | No | Enables pollen data from Tomorrow.io |
| `PURPLEAIR_API_KEY` | No | Enables hyperlocal ground-sensor AQI; falls back to the regional model if unset |
| `CORS_ORIGIN` | Prod only | Comma-separated allowed origins |
| `API_TOKEN` | Prod only | Bearer token for API authentication (auto-generated on first production startup if unset) |
| `VITE_API_TOKEN` | No | Frontend build-time token, must match `API_TOKEN` |
