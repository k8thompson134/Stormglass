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
│  │ Alert Engine             │   │
│  │ Correlation Service      │   │
│  └──────────────────────────┘   │
│                                 │
│  Scheduled Jobs (Cron):         │
│  - API polling per user         │
│  - Derivative computation       │
│  - Alert evaluation            │
└────────┬────────────────────────┘
         │
    ┌────┴─────────────────────────┐
    │                              │
┌───▼──────────┐        ┌─────────▼────┐
│ PostgreSQL   │        │  MQTT Broker │
│ (Drizzle ORM)│        │ (Mosquitto)  │
└──────────────┘        └────────┬─────┘
                                 │
                         ┌───────▼────────┐
                         │ Raspberry Pi   │
                         │ BME280 Sensor  │
                         └────────────────┘
```

## Data Flow

### 1. Weather Data Ingestion
- **Trigger**: Scheduled cron job (every 30 minutes per user location)
- **Sources**: Open-Meteo, Open-Meteo AQI, NOAA
- **Storage**: weather_data, air_quality_data, geomagnetic_data tables
- **Compute**: Pressure derivatives (1h, 3h, 6h rolling windows)

### 2. User Symptom Logging
- **Trigger**: User interaction
- **Input**: Severity scores (1-10 sliders), optional tags, flexible timestamps
- **Storage**: symptom_logs table
- **Offline**: Buffered in IndexedDB, synced on reconnect

### 3. Alert Evaluation
- **Trigger**: New environmental data + cron job check
- **Engine**: Evaluates user_alert_rules against current/forecast conditions
- **Notification**: WebSocket to connected clients, stored in alert_history
- **Examples**: Rapid pressure drop, humidity spike, pollen increase

### 4. Correlation Analysis
- **On-demand**: User requests analysis for date range
- **Processing**: Overlays symptom severity against environmental timeline
- **Features**: Adjustable time-lag shifting (find peak correlation at +2h, +6h, etc.)
- **Output**: Correlation coefficients, visualization data

### 5. Raspberry Pi Sensor (Optional)
- **Hardware**: Pi Zero 2 W + BME280 over I2C
- **Cadence**: Python script publishes every 60 seconds
- **Transport**: MQTT over TLS to backend
- **Data**: Pressure, temperature, humidity (per-minute resolution)
- **Benefit**: 60x resolution vs hourly APIs, measures user's actual environment

## Database Schema (Key Tables)

### Users
- id, email, location, timezone, created_at, updated_at

### WeatherData
- id, user_id, location, timestamp, pressure, temperature, humidity, wind_speed, etc.
- Indexes: (user_id, timestamp), (location, timestamp)

### PressureDerivatives
- id, user_id, location, timestamp, delta_1h, delta_3h, delta_6h, trend
- Pre-computed at ingest time for fast queries

### SymptomLogs
- id, user_id, timestamp, severity (1-10), tags (JSON), notes, synced_at
- Supports backdating for offline entries

### UserAlertRules
- id, user_id, name, condition (JSON: {type, operator, value}), enabled
- Example: {type: "pressure_delta_1h", operator: "<", value: -1.0}

### AlertHistory
- id, user_id, rule_id, triggered_at, condition_value, acknowledged

### AirQualityData, GeromagneticData
- Similar pattern: (user_id, location, timestamp, metric_values)

## API Endpoints (Preliminary)

```
GET  /api/weather/current          - Get latest conditions for user's location
GET  /api/weather/forecast         - 16-day forecast overlay
GET  /api/symptoms/logs            - Retrieve symptom log entries
POST /api/symptoms/logs            - Create/update symptom log
GET  /api/analysis/correlation     - Correlation analysis for date range
GET  /api/alerts/active            - Current active alerts
POST /api/alerts/rules             - Create/update alert rule
GET  /api/alerts/history           - Alert trigger history

WebSocket: /ws                     - Real-time updates (new data, alerts)
```

## Key Algorithms

### Pressure Derivative Computation
```
For each 1-hour, 3-hour, 6-hour window:
  delta = (latest_pressure - oldest_pressure) / window_hours
```

### Correlation Analysis (Preliminary)
```
For each time lag (-24h to +24h step by 1h):
  Compute Pearson correlation between:
    - Environmental metric timeline (pressure, temp, humidity, etc.)
    - Symptom severity timeline (aligned by lag)
  Return lag with highest |correlation|
```

### Alert Evaluation
```
For each enabled alert_rule for user:
  current_conditions = query latest weather data
  if rule.condition(current_conditions) == true:
    - Create alert_history entry
    - Broadcast via WebSocket
    - Store in alert_history for later review
```

## Scalability Considerations

### Current Target
- ~200 users at 30-minute polling intervals
- Open-Meteo free tier: 10,000 calls/day
- Per-user quota: 10,000 / (200 * 3 endpoints * 48 calls/day) ✓ feasible

### If scaling beyond 200 users
1. Move to client-side weather API calls with server-side caching
2. Use Redis for short-term data caching (last 6 hours)
3. Implement request deduplication (batch similar locations)
4. Consider dedicated geospatial database for location grouping

### Storage
- ~3 MB/user/month all sources combined
- 100 users × 12 months = 3.6 GB easily fits on basic PostgreSQL

## Deployment Model

### Development
- Docker Compose locally (Postgres, Mosquitto)
- Both services run in dev mode with hot reload

### Production
- VPS (DigitalOcean/Hetzner, $4–6/mo)
- Caddy reverse proxy with auto HTTPS
- PM2 manages Node.js processes
- PostgreSQL dedicated instance
- Mosquitto optional (MQTT only needed if using Pi)

## Security & Data Privacy

1. **No health data collection at rest** initially — symptom logs stored locally
2. **HTTPS/TLS** for all transmissions
3. **MQTT TLS** for Pi sensor communication
4. **Location-based queries** only — no user tracking beyond their entered location
5. **API keys (future)**: Stored server-side, never exposed to frontend

## Performance Targets

- Dashboard load: <2s on 4G
- Correlation analysis (1 month): <5s
- Alert broadcast: <100ms WebSocket latency
- Weather API polling: non-blocking background job
