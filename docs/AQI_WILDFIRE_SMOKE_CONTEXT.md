# Air Quality / Wildfire Smoke — Context for Claude Code

Quick handoff doc for continuing work on the AQI feature. Written after a session that
made it more local (PurpleAir hyperlocal overlay) and more useful during wildfire smoke
(trend forecasting, sharper guidance).

## Data sources

- **Baseline / regional model**: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
  (CAMS/Copernicus atmospheric model, ~11km grid). Always on, no key required.
  Provides `us_aqi`, `european_aqi`, `pm2_5`, `pm10`, `carbon_monoxide`,
  `nitrogen_dioxide`, `sulphur_dioxide`, `ozone`.
- **Hyperlocal overlay**: [PurpleAir API](https://api.purpleair.com) — real consumer PM2.5
  sensors, dense network, much better at catching localized wildfire smoke plumes than
  the coarse regional model. **Optional** — gated behind `PURPLEAIR_API_KEY`; the app
  falls back cleanly to the Open-Meteo model when unset or on any fetch failure. Key is
  free from https://develop.purpleair.com (points-based, ~1M free points/month).
  Kate already has a key in use for her `lair` home-hub project
  (`~/Library/LaunchAgents/com.lair.api.plist`, same `PURPLEAIR_API_KEY` var) — the
  Stormglass implementation was ported directly from `lair/routes/health.py`'s
  `_fetch_purpleair_aqi` to keep the correction math and sensor-selection logic
  identical across both apps. **Keep the two in sync if either changes.**
- Not used: AirNow, IQAir, raw EPA AirNow API. Open-Meteo + PurpleAir was judged
  sufficient and avoids a second paid/rate-limited integration.

## What's implemented

### Backend
- `backend/src/services/airquality.ts` — fetches Open-Meteo AQ data on each poll
  (every 30 min, see `weather-poll.ts`). `past_days=2`, `forecast_days=3` (72h
  lookahead). **Important**: forecast (future-timestamp) rows are deleted and
  reinserted every poll rather than dedup-inserted — Open-Meteo revises its forecast
  on every run, so treating it as insert-once would leave smoke-trend analysis reading
  a stale prediction for up to 72h. Past/actual rows are still insert-once (immutable
  historical fact).
- `backend/src/services/purpleair.ts` — hyperlocal overlay. Queries a ~0.15° bounding
  box around the configured lat/lon, filters to outdoor sensors
  (`location_type === 0`) with confidence ≥70 and `last_seen` within the last hour,
  averages the 3 nearest, applies the Barkjohn/EPA smoke correction
  (`0.541*pm25_cf1 - 0.0618*RH + 0.00534*tempF + 3.634`, the same formula behind
  AirNow's Fire and Smoke Map), converts to AQI via the official 40 CFR Part 58 App. G
  breakpoint table. Not persisted to the DB — fetched live on each `/current` request.
- `backend/src/utils/smoke.ts` — `analyzeSmokeTrend(pastRows, futureRows)`. Compares
  current PM2.5 to ~6h ago for trend direction (worsening/improving/stable, with a
  3 µg/m³ noise floor), finds the next-24h forecast peak, and flags a "likely wildfire
  smoke" signature: PM2.5 ≥20, PM2.5/PM10 ratio ≥0.65, NO2 ≤15ppb, SO2 ≤5ppb (smoke is
  almost pure particulate; traffic/industrial pollution has more gaseous NO2/SO2).
  Labeled "likely" in all UI copy — it's a heuristic, not a certainty.
- `backend/src/api/weather.ts` (`GET /api/weather/current`) — merges both new pieces
  into the response: `aqi.hyperlocal` and `aqi.smokeTrend` (both nullable).
- `backend/src/api/briefing.ts` (`GET /api/briefing`) — also computes and includes
  `smokeTrend` in `conditions.aqi`. **Known gap, discovered this session but not
  fixed**: `briefingRoutes` is defined here but was never imported/registered in
  `backend/src/server.ts` (no `app.register(briefingRoutes)` call exists). The route
  currently 404s. Fix is a one-line import + register in `server.ts` if this endpoint
  is actually wanted — unclear if it's dead/superseded or just never got wired up.
- `backend/src/env.ts` — `PURPLEAIR_API_KEY` added as optional (same skip-if-unset
  pattern as `TOMORROW_API_KEY`).

### Health risk logic (duplicated by design — see note at top of each `healthLogic.ts`)
- `backend/src/utils/healthRisks.ts` + `frontend/src/utils/healthRisks.ts` —
  `AQI_CONFIG` thresholds (severe/high tiers) now include N95 fit-check guidance,
  HEPA purifier CADR-sizing advice, and a "relocate rather than wait it out" note at
  sustained hazardous levels.
- `backend/src/utils/healthLogic.ts` + `frontend/src/utils/healthLogic.ts` —
  `getAQIRisk()` now accepts optional `hyperlocal` and `smokeTrend` fields on its
  input. Risk *severity* uses `Math.max(modelAqi, hyperlocalAqi)` — deliberately
  erring toward the higher/more protective reading rather than averaging, since
  PurpleAir catches local plumes the model can lag on. Adds a "wildfire smoke
  signature detected" factor when `smokeTrend.likelyWildfireSmoke` is true, and a
  "smoke trending worse, prep now" or "trending better" recommendation based on
  `smokeTrend.direction`.
- `backend/src/utils/healthLogic.test.ts` — covers `getAQIRisk` thresholds and the
  N95 recommendation trigger (renamed from a `'mask'` substring check after the copy
  got more specific).

### Frontend
- `frontend/src/services/api.ts` — `CurrentWeather.aqi` type extended with
  `hyperlocal` and `smokeTrend`.
- `frontend/src/components/HealthImpact.tsx` — no changes needed; it already calls
  `getAQIRisk(data.aqi ?? null)`, so the new fields flow through automatically once
  present on `data.aqi`.
- `frontend/src/components/DataSources.tsx` — Air Quality card corrected (was
  inaccurately describing "EPA and local monitoring stations"; now describes the
  actual Open-Meteo model + optional PurpleAir overlay + correction methodology).
- Nothing yet surfaces `hyperlocal`/`smokeTrend` as distinct UI (e.g. a dedicated
  trend chart or "N sensors nearby" badge) — they currently only affect the existing
  AQI risk card's text via `getAQIRisk`. That was explicitly descoped this round (see
  "Better in-app visibility" — not selected when scoping this work).

### Not persisted / no migration needed
`hyperlocal` and `smokeTrend` are both computed live per-request from data already in
`air_quality_data` (smoke trend) or fetched live from PurpleAir (hyperlocal) — no
schema changes, no new tables, no migration.

## Verification done this session
- `tsc --noEmit` clean on both backend and frontend.
- Backend test suite: 49/49 passing (`cd backend && npx vitest run`).
- `eslint` clean (only pre-existing unrelated warnings).
- Standalone math checks: `analyzeSmokeTrend` behaves correctly on synthetic
  worsening/smoke-like and stable/non-smoke series; PurpleAir correction + AQI
  breakpoint table verified against known boundary values.
- **Live end-to-end run** against the real production Railway Postgres DB
  (`backend/.env`, gitignored) confirmed via `npm run dev` (on port 3901 — 3000 is
  taken locally by another container) and `curl localhost:3901/api/weather/current`:
  hyperlocal returned 3 real PurpleAir sensors 0.4mi away reading AQI 57 vs. the
  model's 35 (a real, meaningful local/model gap), and smoke trend correctly
  identified rising PM2.5 as *not* wildfire smoke (NO2 was 57.9 ppb, well over the
  15ppb ceiling — read as regular pollution instead). Dev server was stopped after
  verification so it isn't double-polling alongside the real deployed instance.

## Possible next steps (not started)
- Wire up `/api/briefing` in `server.ts` if it's meant to be live.
- Dedicated AQI/smoke UI (trend sparkline, "N sensors X mi away" badge) — was
  explicitly out of scope this round.
- Persist `hyperlocal` readings for historical charting (would need a schema
  change/migration; deliberately avoided for now to keep this a lower-risk,
  live-only overlay).
