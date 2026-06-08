# Stormglass

A progressive web app that tracks environmental conditions, logs symptoms, and reveals personal health patterns. Built for people with chronic conditions (migraines, ME/CFS, Long COVID, POTS, fibromyalgia, etc.) where environmental factors trigger symptom flares.

## Features

- **Environmental tracking** — Real-time pressure, temperature, humidity, wind, UV, cloud cover, precipitation with trend indicators
- **Pressure dynamics chart** with rate-of-change visualization, forecast overlay, volatile zone highlighting, and front passage detection
- **Personalized daily risk forecast** showing condition-specific risk levels with recommendations
- **Symptom logger** — Log symptoms with severity levels and environmental snapshots automatically captured
- **Trends & patterns analysis** — Personalized condition-specific trigger identification showing which environmental factors correlate with your symptoms
- **Configurable health conditions** — Choose which conditions to track in daily forecasts
- **Location search** via geocoding — Set your location for accurate local weather
- **Mobile-optimized responsive design** with accessibility improvements
- **PWA with offline support** via Workbox

## How It Works

### Daily Risk Forecast
Shows personalized risk levels for each of your tracked conditions based on current and forecast environmental data. Each condition has specific trigger factors (pressure change, geomagnetic activity, humidity, air quality, pollen).

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

## Data Sources (All Free)

| Source | Data |
|--------|------|
| **Open-Meteo** | Hourly pressure, temperature, humidity, wind, UV, cloud cover, precipitation |
| **Open-Meteo Air Quality** | PM2.5, PM10, ozone, NO2, SO2, CO, US/European AQI |
| **NOAA Space Weather** | Kp index, solar wind speed/density |
| **Tomorrow.io** *(optional)* | Tree, grass, weed, mold pollen indices (requires API key) |

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

# Run database migrations and seed default user
npm run db:migrate
npm run db:seed

# Start both frontend and backend in dev mode
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend on port 3000.

## Project Structure

```
stormglass/
├── frontend/           # React 18 + Vite PWA
│   └── src/
│       ├── components/ # UI components:
│       │   ├── PressureChart.tsx     # Pressure dynamics visualization
│       │   ├── HealthImpact.tsx      # Risk forecast cards with personalized data
│       │   ├── CurrentConditions.tsx # Real-time environmental conditions
│       │   ├── SymptomLogger.tsx     # Symptom logging modal with environment capture
│       │   ├── Insights.tsx          # Condition-specific trigger analysis and trends
│       │   └── Settings.tsx          # Health condition preferences
│       ├── services/   # API client (fetchSymptomLogs, fetchWeather, etc)
│       ├── utils/      # Health risk evaluation logic
│       └── App.tsx     # Main layout and data orchestration
│
├── backend/            # Node.js + Fastify
│   └── src/
│       ├── api/        # Route handlers:
│       │   ├── weather.ts      # Environmental data endpoints
│       │   ├── settings.ts     # User preferences
│       │   ├── symptoms.ts     # Symptom log CRUD
│       │   └── correlations.ts # Trigger analysis endpoints
│       ├── services/   # Data fetching (Open-Meteo, NOAA, Tomorrow.io)
│       ├── db/         # Drizzle schema and migrations
│       ├── jobs/       # Cron scheduler (weather polling every 30 min)
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
| `DEFAULT_LATITUDE` | No (40.7128) | Default polling location latitude |
| `DEFAULT_LONGITUDE` | No (-74.0060) | Default polling location longitude |
| `TOMORROW_API_KEY` | No | Enables pollen data from Tomorrow.io |
| `CORS_ORIGIN` | Prod only | Comma-separated allowed origins |
| `API_TOKEN` | Prod only | Bearer token for API authentication |


