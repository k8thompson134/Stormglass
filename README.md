# Stormglass

A progressive web app that tracks environmental conditions and correlates them with chronic illness symptoms. Designed for people with ME/CFS, Long COVID, POTS, fibromyalgia, and other conditions where weather patterns drive symptom flares.

## Key Features

- **Real-time barometric pressure dashboard** with rate-of-change visualization and forecast overlay
- **Correlation analysis view** overlaying symptom severity scores on environmental timelines with adjustable time-lag shifting
- **User-configurable alerts** when environmental conditions cross personal thresholds
- **Low-friction symptom logging** with quick-entry sliders, preset tags, offline support, and flexible timestamps
- **Optional Raspberry Pi sensor integration** for hyper-local per-minute data (pressure, temperature, humidity)
- **Works offline** with Workbox PWA support
- **Multi-user architecture** supporting server-side location-based polling

## Tech Stack

### Frontend
- React 18 + TypeScript + Vite
- Recharts for interactive time-series charts
- Tailwind CSS for styling
- Workbox (via vite-plugin-pwa) for PWA/offline support
- WebSocket for real-time sensor updates

### Backend
- Node.js + Fastify + TypeScript
- PostgreSQL 16 with Drizzle ORM
- Cron jobs for data ingestion and computations
- MQTT broker (Mosquitto) for Pi sensor communication
- WebSocket support for real-time updates

### Infrastructure
- Docker + Docker Compose
- Caddy reverse proxy with auto HTTPS
- PM2 for process management
- DigitalOcean or Hetzner VPS

### Data Sources (All Free)
- **Open-Meteo** — hourly/15-min pressure, temp, humidity, wind, UV, cloud cover, precipitation, 80+ year archive
- **Open-Meteo Air Quality** — PM2.5, PM10, ozone, NO2, SO2, CO, AQI (hourly, 11km resolution)
- **NOAA Space Weather** — Kp index (geomagnetic activity), solar wind data

### Future Integrations
- Google Pollen API (tree, grass, weed pollen at 1km)
- AirNow (EPA ground measurements)
- OpenAQ (community air quality)

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16
- Docker & Docker Compose (optional)

### Local Development

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Set up environment
cp backend/.env.example backend/.env
# Edit .env with your database connection

# Set up database
cd backend
npm run db:migrate

# Start backend
cd backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

## Project Structure

```
stormglass/
├── frontend/              # React PWA
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API clients, WebSocket
│   │   ├── stores/       # State management
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   ├── public/           # Static assets
│   └── tests/            # Frontend tests
│
├── backend/               # Node.js + Fastify server
│   ├── src/
│   │   ├── api/          # Fastify routes
│   │   ├── services/     # Business logic (alerts, correlation, polling)
│   │   ├── db/           # Drizzle schema and migrations
│   │   ├── jobs/         # Cron job definitions
│   │   ├── mqtt/         # MQTT client setup
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   ├── tests/            # Backend tests
│   └── migrations/       # Database migrations
│
├── shared/                # Shared types and utilities
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Shared utilities
│
├── docs/                  # Documentation
│   ├── architecture/      # System design docs
│   ├── deployment/        # Deployment guides
│   └── api-specs/         # API specifications
│
├── .github/workflows/     # CI/CD workflows
├── docker-compose.yml     # Multi-container dev setup
├── Dockerfile             # Backend container
└── .env.example           # Example environment variables
```

## Data Model

### Core Tables
- `sensor_readings` — local Raspberry Pi measurements
- `weather_data` — Open-Meteo API data
- `air_quality_data` — AQI and pollutant levels
- `geomagnetic_data` — Kp index and solar wind
- `pressure_derivatives` — pre-computed 1h, 3h, 6h rate of change
- `symptom_logs` — user-submitted symptom scores
- `user_alert_rules` — configurable thresholds
- `alert_history` — triggered alerts for analysis

### Computed Metrics
- Pressure rate of change (1h, 3h, 6h windows)
- Temperature deltas
- Pressure trend (rising/falling/stable)
- Indoor vs outdoor differentials (with Pi sensor)

## Key Architecture Decisions

1. **Server-side polling per user location** to start, with path to client-side + server caching at scale
2. **Pressure rate of change** as primary health correlate (research suggests >1 hPa/hr is clinically significant)
3. **PWA with offline support** for reliability during symptom flares
4. **Optional Pi sensor** adds 60x resolution vs weather APIs (per-minute local vs hourly modeled)
5. **Type-safe database** with Drizzle ORM for migrations and queries
6. **Real-time WebSocket** for live sensor updates and alert notifications

## Storage Estimates
~3 MB per user per month across all data sources. Years of data for hundreds of users on basic PostgreSQL.

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

MIT (pending decision on health data handling)

## Support & Resources

- **Documentation**: See `docs/` folder
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
