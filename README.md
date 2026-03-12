# Stormglass

A progressive web app that tracks environmental conditions and shows their potential health impact. Built for people with migraines, ME/CFS, Long COVID, POTS, fibromyalgia, and other conditions where weather patterns drive symptom flares.

## Features

- **Pressure dynamics chart** with rate-of-change visualization, forecast overlay, volatile zone highlighting, and front passage detection
- **Health impact forecast** showing personalized risk levels for 7 conditions (migraine, POTS, ME/CFS, joint pain, air quality, geomagnetic, pollen) with detailed explanations and recommendations
- **Current conditions snapshot** — pressure, temperature, humidity, wind, UV, cloud cover, precipitation with trend indicators
- **Configurable health toggles** — choose which conditions to track
- **Location search** via geocoding — set your location for accurate local data
- **PWA with offline support** via Workbox

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
├── frontend/           # React + Vite PWA
│   └── src/
│       ├── components/ # PressureChart, HealthImpact, CurrentConditions, Settings
│       ├── services/   # API client
│       ├── utils/      # Health risk evaluation logic
│       └── App.tsx     # Main layout and data orchestration
│
├── backend/            # Node.js + Fastify
│   └── src/
│       ├── api/        # Route handlers (weather, settings, geocode)
│       ├── services/   # Data fetching (Open-Meteo, NOAA, Tomorrow.io)
│       ├── db/         # Drizzle schema and migrations
│       ├── jobs/       # Cron scheduler (polls every 30 min)
│       └── server.ts   # Fastify app setup
│
├── shared/             # Shared TypeScript types and utilities
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


