# Stormglass

> A progressive web app that tracks environmental conditions and correlates them with chronic illness symptoms.

Designed for people living with **ME/CFS, Long COVID, POTS, fibromyalgia**, and other conditions where weather patterns drive symptom flares.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Data Model](#data-model)
- [Architecture Decisions](#architecture-decisions)
- [Storage Estimates](#storage-estimates)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Barometric pressure dashboard** — real-time rate-of-change visualization with forecast overlay
- **Correlation analysis** — overlay symptom severity scores on environmental timelines with adjustable time-lag shifting
- **Configurable alerts** — notifications when conditions cross your personal thresholds
- **Low-friction symptom logging** — quick-entry sliders, preset tags, offline support, and flexible timestamps
- **Raspberry Pi sensor integration** — optional hyper-local per-minute data (pressure, temperature, humidity)
- **Offline-first PWA** — Workbox service worker keeps the app functional without a connection
- **Multi-user support** — server-side location-based polling per account

---

## Tech Stack

### Frontend

| Tool | Purpose |
|------|---------|
| React 18 + TypeScript + Vite | UI framework |
| Recharts | Interactive time-series charts |
| Tailwind CSS | Styling |
| Workbox / vite-plugin-pwa | PWA & offline support |
| WebSocket | Real-time sensor updates |

### Backend

| Tool | Purpose |
|------|---------|
| Node.js + Fastify + TypeScript | HTTP server |
| PostgreSQL 16 + Drizzle ORM | Database |
| Cron jobs | Data ingestion & computations |
| Mosquitto MQTT | Raspberry Pi sensor communication |
| WebSocket | Real-time push updates |

### Infrastructure

| Tool | Purpose |
|------|---------|
| Docker + Docker Compose | Container orchestration |
| Caddy | Reverse proxy with auto HTTPS |
| PM2 | Process management |
| DigitalOcean / Hetzner VPS | Hosting |

### Data Sources (All Free)

| Source | Data |
|--------|------|
| [Open-Meteo](https://open-meteo.com) | Hourly/15-min pressure, temp, humidity, wind, UV, cloud cover, precipitation, 80+ year archive |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | PM2.5, PM10, ozone, NO2, SO2, CO, AQI (hourly, 11 km resolution) |
| [NOAA Space Weather](https://www.swpc.noaa.gov) | Kp index (geomagnetic activity), solar wind data |

### Planned Integrations

- Google Pollen API — tree, grass, and weed pollen at 1 km resolution
- AirNow — EPA ground measurements
- OpenAQ — community air quality data

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16
- Docker & Docker Compose *(optional but recommended)*

### Local Development

```bash
# Clone the repo
git clone https://github.com/<your-org>/stormglass.git
cd stormglass

# Install all workspace dependencies (frontend, backend, shared)
npm install

# Configure the backend environment
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set DATABASE_URL

# Run database migrations
npm run db:migrate

# Start the full stack (frontend + backend in parallel)
npm run dev
```

Frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:3000`.

### Docker Compose

```bash
docker compose up --build
```

---

## Project Structure

```
stormglass/
├── frontend/                  # React PWA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API clients, WebSocket
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utilities
│   └── public/                # Static assets
│
├── backend/                   # Node.js + Fastify API server
│   ├── src/
│   │   ├── api/               # Fastify route definitions
│   │   ├── db/                # Drizzle schema & migrations
│   │   ├── jobs/              # Cron job definitions
│   │   ├── services/          # Business logic (alerts, correlation, polling)
│   │   └── mqtt/              # MQTT client setup
│   └── migrations/            # Database migration files
│
├── shared/                    # Shared types & utilities
│   ├── types/
│   └── utils/
│
├── docs/                      # Documentation
│   ├── architecture/          # System design docs
│   ├── deployment/            # Deployment guides
│   └── api-specs/             # API specifications
│
├── docker-compose.yml
├── mosquitto.conf
└── package.json               # Root workspace config
```

---

## Environment Variables

Backend reads from `backend/.env`. All variables are validated at startup via `backend/src/env.ts`.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/dbname` |
| `NODE_ENV` | No | `development` | Set to `production` for stricter startup checks |
| `PORT` | No | `3000` | Server listen port |
| `HOST` | No | `0.0.0.0` | Server listen host |
| `DEFAULT_LATITUDE` | No | `40.7128` | Default latitude for weather polling |
| `DEFAULT_LONGITUDE` | No | `-74.0060` | Default longitude for weather polling |
| `CORS_ORIGIN` | Prod only | — | Comma-separated allowed origins, e.g. `https://app.example.com` |
| `API_TOKEN` | Prod only | — | Bearer token for `/api/*` routes. If unset in dev, API is unauthenticated |
| `TOMORROW_API_KEY` | No | — | Enables pollen data from Tomorrow.io when set |

Frontend (Vite) uses `VITE_`-prefixed variables. Set `VITE_API_URL` and `VITE_API_TOKEN` when building for production.

> **Note:** Never commit `.env` files. Configure production secrets via your platform's secret management (Docker env, PaaS config, etc.). The app fails fast on missing required variables.

---

## Data Model

### Core Tables

| Table | Description |
|-------|-------------|
| `sensor_readings` | Local Raspberry Pi measurements |
| `weather_data` | Open-Meteo API data |
| `air_quality_data` | AQI and pollutant levels |
| `geomagnetic_data` | Kp index and solar wind |
| `pressure_derivatives` | Pre-computed 1 h, 3 h, 6 h rates of change |
| `symptom_logs` | User-submitted symptom scores |
| `user_alert_rules` | Configurable threshold rules |
| `alert_history` | Triggered alert records for analysis |

### Computed Metrics

- Pressure rate of change (1 h, 3 h, 6 h windows)
- Temperature deltas
- Pressure trend classification (rising / falling / stable)
- Indoor vs. outdoor differentials (when Pi sensor is connected)

---

## Architecture Decisions

1. **Server-side location polling per user** — straightforward to start; designed with a path to client-side requests + server caching at scale.
2. **Pressure rate of change as primary correlate** — research suggests changes >1 hPa/hr are clinically significant for many conditions.
3. **PWA with offline support** — ensures the app stays usable during symptom flares when connectivity may be unreliable.
4. **Optional Pi sensor** — adds ~60x data resolution vs. weather APIs (per-minute local readings vs. hourly modeled data).
5. **Drizzle ORM** — type-safe schema, migrations, and queries with minimal overhead.
6. **WebSocket for real-time updates** — live sensor data and alert notifications without polling.

---

## Storage Estimates

~3 MB per user per month across all data sources. Basic PostgreSQL handles years of data for hundreds of users comfortably.

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines, branch conventions, and PR requirements.

---

## License

MIT — see [LICENSE](LICENSE) for details.

> Health data handling policy is pending review. Do not store identifiable health information in production until a privacy policy is in place.

---

## Support & Resources

- **Documentation:** `docs/` folder
- **Bug reports:** [GitHub Issues](../../issues)
- **Questions & discussion:** [GitHub Discussions](../../discussions)
