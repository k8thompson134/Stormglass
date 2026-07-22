# Air Quality / Wildfire Smoke — Handoff for Claude Code
## Testing plan for current implementation + proposed additions

This builds on the prior session's handoff (Open-Meteo baseline + PurpleAir hyperlocal
overlay + smoke trend heuristic — see `AQI_WILDFIRE_SMOKE_CONTEXT.md`). That doc covers
what's built; this one covers **what to verify before trusting it in production**, plus
**where to take it next**, with an eye toward actually being useful to someone managing
wildfire-smoke-sensitive chronic illness in real time (that's the actual use case — not a
generic weather feature).

## Part 1 status: done (this session)

All 7 testing items below were worked through. Summary:

- **No bugs found** in `analyzeSmokeTrend`, the PurpleAir correction/AQI math, or
  `getAQIRisk`'s hyperlocal-vs-model blending — all behaved correctly against edge
  cases on the first test run.
- **Two real gaps fixed**:
  - `airquality.ts`'s forecast delete-reinsert (item 6) is now wrapped in a
    `db.transaction()` so a concurrent read can't observe an empty window.
  - `/api/briefing` (item 4) was confirmed 404ing live, then wired into `server.ts`
    (`app.register(briefingRoutes)`) and re-verified live against production data,
    including the new `smokeTrend` field. Kept, not deleted — this is an existing,
    long-standing issue, not a throwaway route.
- **33 new tests added, 90/90 passing**: `backend/src/utils/smoke.test.ts` (18),
  `backend/src/services/purpleair.test.ts` (11), 7 new cases in
  `backend/src/utils/healthLogic.test.ts`, and a new integration-test pattern for
  routes in `backend/src/api/weather.test.ts` (4) — the first route-level tests in
  this codebase, using a minimal fake drizzle chain + Fastify `.inject()` rather than
  a real DB.
- **Item 5 (rate-limit math) — resolved, and the earlier "qualitatively light"**
  **assessment was wrong.** Found real per-field point costs on the PurpleAir
  community forum (staff-confirmed formula: `base_cost + field_costs × rows`;
  e.g. temperature=2pts/row, humidity_a=1pt/row, pm2.5_cf_1_a/b=1pt/row each).
  Critically, `fetchHyperlocalAQI` was being called **live on every single
  `/api/weather/current` and `/api/briefing` request** — not on the 30-min poll
  cadence originally assumed. With the frontend's 5-min auto-refresh (plus lair's
  own polling, plus manual use), real call volume is 200-400+/day, not 48/day.
  Measured live: a Chicago bounding box returns 57 sensor rows in one call. Worked
  the math: at that density and call volume, this could burn **3-6x the 1M/month
  free points tier**, every month, indefinitely — a real, serious risk, not a minor
  one. **Fixed**: added a 60-minute in-memory TTL cache (keyed by lat/lon) in
  `purpleair.ts`, so PurpleAir is now called at most 24x/day regardless of request
  volume — landing at roughly 289k-495k points/month, comfortably under budget with
  real margin. 3 new caching tests (cache hit, different-location miss, null-result
  caching so a sustained outage doesn't retry every request). Still worth checking
  your actual points balance at develop.purpleair.com periodically, since the
  per-field costs above are sourced from a community forum post, not the
  authoritative (login-gated) pricing page.

## Part 2 status

- **(A) done** — `GET /api/weather/aqi-forecast` exposes the 72h forecast already
  being fetched/stored; `AQIForecastChart.tsx` renders it.
- **(B) done** — `backend/src/utils/aqiWindows.ts` (`findSafeWindows`/`nextSafeWindow`)
  scans that same forecast for contiguous below-threshold stretches (default
  threshold 100, the AQI_CONFIG moderate ceiling; overridable via `?threshold=`).
  Tolerates a single-hour spike without fragmenting an otherwise-clear window
  (configurable gap tolerance, default 1h) but reports the true max honestly rather
  than averaging the spike away. Wired into the same `/api/weather/aqi-forecast`
  response as `safeWindows`/`nextSafeWindow` — no extra round trip. Frontend shows
  this as the lead callout ("Clear now — safe through Thu 6pm" / "Next clear window:
  ..." / "No safe window in the next 72h"), plus light shading on the chart for each
  safe window. 14 new unit tests on the window logic (empty/all-safe/all-unsafe,
  spike tolerance both merging and correctly *not* merging, current-window
  detection), 2 new integration tests on the endpoint. 108/108 backend tests passing.
  Verified live against production data at both the default threshold (one 76h
  window right now) and a stricter one (splits into 3 distinct windows) — confirms
  the split logic actually fires on real data, not just synthetic test cases.
- (C) — not started (skipped at user's choice: not wanted right now).
- **(D) done** — `backend/src/utils/aqiWindows.ts` (`findNextCategoryCrossing`/
  `classifyAqiCategory`) scans the forecast for the next time AQI crosses into a
  *worse* category than right now (never reports an improving crossing). Wired into
  `/api/weather/aqi-forecast` as `categoryCrossing`. Frontend shows an orange/red
  "Heads up — crosses into Unhealthy around 5 PM" banner above the safe-window
  callout. 6 new unit tests, verified live (both a real `null` case and an injected
  crossing via Playwright route interception).
- **(E) done** — `backend/src/utils/aqiBurden.ts` (`summarizeAqiBurden`) groups past
  (never forecast) readings by UTC calendar day and counts days at/above a threshold
  over the last N days (default 90). New `GET /api/weather/aqi-burden?days=&threshold=`
  endpoint; new `AQISeasonSummary.tsx` card ("2 of 3 days have hit AQI 100+"), hidden
  until at least 3 days of real history exist so it never shows a misleading tiny
  sample. 5 new unit tests + 3 integration tests. Verified live against real data.
- **(F) done** — `CurrentConditions.tsx`'s AQI badge previously showed only the raw
  regional-model number, silently disagreeing with the risk card (which already used
  `max(model, hyperlocal)`). Now shows the same effective value, with both readings
  listed below it and the one actually driving the number bolded — "3 sensors
  (0.4mi): 50 · **model: 64** (using higher)." Verified via screenshot.
- **Bugs found and fixed via `/qa-review` after D/E/F landed** (see
  `reviews/2026-07-21-aqi-wildfire-smoke.md` for the full writeup):
  - The six conditions wired to AQI as a contributing factor (migraine, ME/CFS, POTS,
    joint pain, fibromyalgia, sinus) were reading the raw model AQI, not the
    hyperlocal-aware effective value `getAQIRisk` uses — meaning they'd miss exactly
    the local smoke plume the PurpleAir integration exists to catch. Fixed in both
    `HealthImpact.tsx` and `briefing.ts` (which additionally never fetched hyperlocal
    at all until this fix — now it does).
  - `AQIForecastChart`/`AQISeasonSummary` treated a genuine backend outage
    identically to "no data yet" (both silently render nothing). Now shows a distinct
    error state, verified live via a simulated connection failure.
  - **Separately, a bigger bug was found and fixed this session**: the server never
    loaded the saved location from the DB on startup — it always booted from
    `.env`'s `DEFAULT_LATITUDE/LONGITUDE`, and location changes were never persisted
    back to the `users` table at all. Any restart (deploy, crash) silently reverted
    to the wrong location. Added a `users.name` column (migration `0004`), fixed
    `ensureDefaultUser()`/`server.ts` to boot from the persisted location, and fixed
    `POST /api/settings/location` to actually write back to the DB. Verified
    end-to-end: set location → confirmed in DB → killed and restarted the server →
    confirmed it came back correctly instead of reverting to NYC.

---

## Part 1: Testing the current implementation

### 1. `analyzeSmokeTrend()` — edge cases beyond the happy path
The prior session verified it against clean synthetic worsening/stable series. Still
untested, worth adding:
- **Missing/sparse data**: what happens with 0 past rows, 1 past row, or a gap in the
  6h-ago comparison window (e.g. a poll was missed)? Should degrade gracefully, not throw
  or silently return a misleading trend.
- **Boundary values**: PM2.5 exactly 20, ratio exactly 0.65, NO2 exactly 15ppb — confirm
  `>=`/`<=` vs `>`/`<` matches the documented thresholds exactly (off-by-one here changes
  whether a real smoke event gets flagged).
- **Noise floor interaction**: PM2.5 moving by exactly 3 µg/m³ (the noise floor) — does it
  read as "stable" or does the boundary tip it either way inconsistently?
- **Conflicting signals**: PM2.5 high + PM10 ratio high (smoke-like) but NO2 *also* high
  (e.g. smoke rolling through during rush hour traffic) — this is a real scenario (wildfire
  smoke doesn't suspend car exhaust), confirm it fails safe (labeled "likely," not "smoke
  detected" with false confidence either way).

### 2. PurpleAir fallback behavior
- Confirm the app functions with `PURPLEAIR_API_KEY` unset (documented as clean fallback —
  add an explicit test, not just manual verification).
- Simulate a PurpleAir fetch timeout/500 and confirm it falls back to Open-Meteo rather than
  erroring the whole `/current` response.
- **Fewer than 3 outdoor sensors in the 0.15° box**: does it average what's available, or
  fail? Rural/low-density areas will hit this regularly.
- **Stale sensors**: all sensors in range have `last_seen` >1hr old — confirm it falls back
  rather than returning a stale hyperlocal reading with no staleness indicator.
- **Confidence filtering**: sensors with confidence <70 near the boundary — confirm they're
  actually excluded, not just deprioritized.

### 3. `getAQIRisk()` with hyperlocal vs. model disagreement
The live test already surfaced a real case worth turning into a permanent regression test:
hyperlocal AQI 57 vs. model AQI 35 (real gap, same day, same location). Add this as a fixed
test case, plus:
- A case where hyperlocal is *lower* than model (model overestimating) — confirm `Math.max`
  still correctly favors the *worse* reading, not just "the PurpleAir one."
- `hyperlocal: null` (fallback active) — confirm risk calc uses model AQI alone without
  erroring on the missing field.

### 4. The `/api/briefing` 404
This needs a decision, not just a note: either wire it up (one-line fix per the prior doc)
or remove the dead route so it stops looking like a working endpoint. Leaving a 404'ing
route in the API surface is a footgun for future-you or future-Claude-Code assuming it works.

### 5. Rate limit math
PurpleAir free tier is ~1M points/month. Back-of-envelope check: poll frequency (every 30
min) × points per request (3 sensors × however many fields are pulled) × 30 days — confirm
this comfortably stays under budget, especially if hyperlocal ever gets called more often
than the poll cycle (e.g. if a future "refresh now" button is added).

### 6. Concurrency on forecast delete-reinsert
`airquality.ts` deletes and reinserts forecast rows every poll. If a request for
`/api/weather/current` lands *during* that delete-reinsert window, confirm it doesn't read a
transient empty state. Worth wrapping in a transaction if not already.

### 7. Integration test
One end-to-end test hitting `/api/weather/current` with hyperlocal populated, and one with
it null (key unset or fetch failed) — confirming the full response shape is correct in both
cases, not just that individual functions don't throw.

---

## Part 2: Proposed additions

### A. Surface the forecast that's already being fetched
`airquality.ts` already pulls `forecast_days=3` (72h) from Open-Meteo — it's in the
database, just not exposed as anything other than "next-24h peak" inside the smoke trend
calc. This is the highest-value, lowest-effort addition: a simple hourly/daily AQI forecast
view surfaces data that's already being paid for in API calls and already sitting in
Postgres. No new integration needed.

### B. "Safe window" framing, not just current-state framing
For someone pacing around a shrinking, unpredictable window of tolerable air, the most
useful question isn't "what's the AQI right now" — it's "**when is the next stretch where
it's safe to go outside, and how long will it last**." Concretely: scan the 72h forecast for
contiguous blocks under a configurable threshold (e.g. moderate/yellow) and surface them as
windows ("clear from ~2pm–6pm tomorrow") rather than a single number. This is a genuinely
different feature from a trend arrow — it answers the actual planning question.

### C. Location-compare mode
A recurring real use case: comparing current location's AQI against a candidate destination
before deciding whether a trip is worth it (e.g. "is it worth driving somewhere with
better air today"). The backend already has the lat/lon-based Open-Meteo call — a second
optional lat/lon param on `/current` (or a new lightweight `/compare` endpoint) that runs
the same fetch against a second location would let the frontend show a side-by-side without
duplicating logic. Doesn't need PurpleAir hyperlocal for the comparison location — model-only
is fine for a decision at that distance.

### D. Threshold-crossing alerts, not just current-state display
Someone checking the app manually multiple times a day during a smoke event is itself a
cognitive-load cost. A simple "AQI is forecast to cross into [worse tier] at approximately
[time]" notification — computed from the same forecast data already being fetched — turns
this from a thing you have to remember to check into a thing that tells you. Even without
push infra, a prominent "crosses into Unhealthy around 4pm" banner beats a bare number.

### E. Historical burden tracking
For seasonal pattern awareness (how much of this summer has actually been bad, cumulatively)
— a simple count of "days at/above X threshold this season" from the already-stored past
rows. Doesn't need new data collection, just an aggregate query. Useful for noticing whether
a season is trending worse than the last one, which currently requires manually remembering.

### F. Explicit staleness/confidence indicators in the UI
Given how much the hyperlocal-vs-model gap matters (57 vs 35 is not a rounding error), the
UI should show *which* source is driving the current risk level, not just the final number.
"Based on 3 sensors 0.4mi away" vs. "Based on regional model (~11km grid)" changes how much
someone should trust the reading when deciding whether to open a window.

---

## Suggested order of operations
1. Testing gaps (Part 1) first — especially the fallback/edge-case tests, since those are
   silent-failure risks in exactly the moment (active smoke event) when the feature matters most.
2. (A) Surface existing forecast data — cheapest win, no new integration.
3. (B) Safe-window framing — biggest jump in actual usefulness, builds directly on (A).
4. (C)/(D)/(E)/(F) — pick based on what's actually wanted next; none are blocking on each other.

## Post-D/E/F follow-up round (2026-07-21, later same day)

Did improvements (1) PurpleAir rate-limit math, (2) low-confidence sensor caveat, and
(5) local-day burden grouping — see the qa-review at
`reviews/2026-07-21-aqi-wildfire-smoke.md` for (1)/(2)/(5) in detail (1 turned out to
be a real, serious finding: the PurpleAir call was uncached and could burn 3-6x the
free monthly points budget — fixed with a 60-minute cache).

(3) push notifications was scoped, not built — see
`docs/FUTURE_push_notifications_scope.md` and lair task board #226. (4) porting
frontend's "sustained pressure trend" migraine logic to backend remains open,
unstarted.

Also did a chart redesign: `AQIForecastChart` now matches `PressureChart`'s style —
6h/24h/48h/7d switcher, Forecast/PM2.5 toggles, dual-axis lines. Found and fixed two
real bugs along the way (both via a follow-up `/qa-review`, see
`reviews/2026-07-21-aqi-chart-redesign.md`):
- The chart's forecast window was always fixed at 72h regardless of the selected
  history range, unlike PressureChart's `Math.min(hours, 48)` scaling — made the 6h
  view nearly useless (forecast-off showed almost nothing; forecast-on let a 72h
  forecast dwarf a 6h sliver of real data). Fixed: the *chart's own series* now
  scales as `Math.min(hours, 72)`, matching PressureChart's relationship — but
  safeWindows/nextSafeWindow/categoryCrossing still always evaluate the full 72h
  outlook underneath, so the "clear through Thursday"-style callout doesn't shrink
  along with the chart's zoom.
- Copy revision: dropped "Clear"/"safe" language in the safe-window callout (too
  declarative/absolute for a health tool) in favor of "Currently below AQI 100 —
  expected to hold through..." — more advisory, less definitive-sounding.
