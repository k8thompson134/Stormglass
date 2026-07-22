# QA Review: AQI / Wildfire Smoke Feature

**Date:** 2026-07-21
**Mode:** Feature review (no args — inferred scope from `git diff`/session context)
**Scope:** PurpleAir hyperlocal integration, smoke trend analysis, safe windows,
category-crossing alerts, historical burden tracking, source/confidence indicators,
AQI-as-risk-factor wiring across 6 conditions, and a location-persistence fix.
23 files changed, ~965 insertions, 9 new files (before this review's own fixes).

## 1. Error paths

`purpleair.ts` — good: try/catch, returns `null` on any failure, verified live and via
11 unit tests covering timeout/500/malformed-response cases.

`airquality.ts` — no local try/catch, but throws are caught by `weather-poll.ts`'s
`runPoll` wrapper (pre-existing pattern, consistent with `openmeteo.ts`/`tomorrow.ts`).
Fine.

New routes (`/aqi-forecast`, `/aqi-burden`) have no explicit try/catch — matches every
existing route in this codebase (none do), so not a regression, just worth naming: a
DB-down scenario falls through to Fastify's generic 500 for all routes uniformly,
including these two. Not fixed (systemic, out of scope for this feature's review).

**Found and fixed:** `AQIForecastChart` and `AQISeasonSummary` both did
`.catch(() => setX(null))`, treating a genuine backend outage identically to "no data
configured yet" — both rendered nothing. Confirmed live by killing the backend and
hitting the endpoint through the Vite proxy (500), which the UI treated the same as a
fresh install. For a feature whose entire premise is "tell me during a smoke event,"
silently vanishing during an outage is close to the worst failure mode available.
Fixed: both components now track a distinct `error` state and show an explicit
message ("Couldn't load the air quality forecast — the server may be unreachable")
rather than disappearing. Verified via Playwright with a simulated connection
failure — screenshot confirmed both the prominent (forecast) and quiet (season
summary) treatments render correctly and distinctly.

## 2. Loading / pending states

Both new components show a pulsing skeleton while loading. Fine, no changes needed.

## 3. Third-party-down handling

PurpleAir down → clean fallback to model-only, verified. Open-Meteo down → poll
cycle logs and skips, doesn't crash (an actual 503 occurred live during this session
and the app kept running without incident).

## 4. Schema / migration completeness

Added `users.name` column (as part of the location-persistence fix), generated via
`drizzle-kit generate`, applied via `db:migrate` to the real production DB, verified
with a direct query that the column exists and holds data. Journal/snapshot metadata
consistent. No drift.

## 5. Consistency across touchpoints

**Found and fixed:** the six conditions newly wired to AQI (migraine, ME/CFS, POTS,
joint pain, fibromyalgia, sinus) received the raw regional-model AQI, not the
hyperlocal-aware `effectiveAqi = max(model, hyperlocal)` that `getAQIRisk` and the
`CurrentConditions` badge use. This defeated the point in exactly the scenario the
whole PurpleAir feature exists for — earlier this session we saw model=35 vs.
hyperlocal=57; under that gap, these six conditions would have silently under-reacted
while the AQI card correctly flagged it. Fixed in both `HealthImpact.tsx` (frontend)
and `briefing.ts` (backend) to compute and pass the effective value instead.

**Found while fixing the above:** `briefing.ts` never fetched hyperlocal AQI at all —
that was only ever wired into `/api/weather/current`. Fixed: `briefing.ts` now calls
`fetchHyperlocalAQI` in its own `Promise.all` and includes it in `aqiInput`, matching
`/current`'s behavior.

**Found, not fixed (pre-existing, predates this session):** backend's
`getMigraineRisk` lacks the "sustained pressure trend" amplifier that frontend's has
always had — confirmed via `git diff HEAD` that this predates this session's changes.
Both got this session's AQI multiplier layered on top, but backend's is now
amplifying a strictly simpler base calculation than frontend's for the same
condition, on `/api/briefing`. Left as-is: fixing it means porting real logic (not a
one-line tweak) and is a pre-existing gap this session didn't create, just touched.

## 6. Docs

**Found and fixed:** `docs/AQI_WILDFIRE_SMOKE_TESTING_PLAN.md` still said *"(C)/(D)/
(E)/(F) — not started"* even though D/E/F shipped and were verified in this same
session, and the location-persistence fix wasn't recorded anywhere. Updated with full
status for D/E/F and a summary of the bugs found/fixed via this review.

## 7. Honesty check — what got cut

All previously disclosed in conversation, summarized here per the checklist:
- PurpleAir hyperlocal reading is never persisted to the DB (live-only overlay,
  deliberate scope decision).
- PurpleAir rate-limit math was never resolved with real numbers — their per-field
  point cost is behind a login that wasn't reachable; left as "check your points
  balance after a day of running" rather than a fabricated figure.
- Feature (C), location-compare, skipped at the user's explicit choice.
- "Likely wildfire smoke" is a heuristic, consistently labeled "likely," never
  asserted as fact.
- `aqiBurden`'s day-grouping uses UTC calendar days, not the user's local day
  boundary (documented in-code as an accepted approximation — matters only near
  midnight).
- No minimum-sensor-count floor on PurpleAir — it will average a single sensor with
  no confidence caveat surfaced to the user.
- (D)'s alert is in-app only — no push notification, so it still requires opening
  the app to see it.
- AQI was deliberately *not* added to Raynaud's, EDS, cluster headache, or
  geomagnetic risk — documented physiological reasoning each time (no plausible
  mechanism), not an oversight.

## 8. Security sanity

All DB access via drizzle's parameterized query builder — no raw SQL anywhere in the
new code (grepped for `sql\``/`.execute(`/`raw(` across all new files, zero hits).
Query params (`threshold`, `days`) are parsed as int and clamped to sane ranges. The
`?threshold=0` case was specifically checked (a `parsedThreshold || 100` pattern would
have silently discarded a legitimate zero — this was actually caught and fixed earlier
in the session, confirmed still correct here). PurpleAir key is server-side only,
`.env` gitignored, confirmed. No new injection surface.

---

## Bugs / defects — ranked

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | Six AQI-wired conditions used raw model AQI instead of hyperlocal-aware effective value (fixed) | high | xs | P0 |
| 2 | `briefing.ts` never fetched hyperlocal AQI at all (fixed) | medium | xs | P0 |
| 3 | AQI forecast/season-summary cards silently vanish on real outage, indistinguishable from no-data (fixed) | medium-high | s | P0 |
| 4 | Docs (`AQI_WILDFIRE_SMOKE_TESTING_PLAN.md`) stale re: D/E/F status (fixed) | low | xs | P2 |
| 5 | Backend `getMigraineRisk` lacks frontend's "sustained pressure" amplifier (pre-existing, not fixed) | medium | m | P2 |

## Improvements — ranked

| # | Improvement | Value | Effort | Priority |
|---|-------------|-------|--------|----------|
| 1 | Resolve PurpleAir rate-limit math with real numbers from the dashboard | medium | s | P2 |
| 2 | Surface a low-confidence caveat when hyperlocal is based on only 1 sensor | medium | s | P2 |
| 3 | Push notification for category-crossing alert (D), not just in-app banner | high | l | P3 |
| 4 | Port frontend's "sustained pressure trend" migraine logic into backend for parity | medium | m | P2 |
| 5 | `aqiBurden` day-grouping by user's local day instead of UTC | low | s | P3 |

## Candidate learnings

- **Multi-source data (model + hyperlocal sensor) needs one "effective value" helper,
  not ad-hoc `max()` calls at each call site.** This review found the same
  model-vs-hyperlocal blending logic correctly implemented in `getAQIRisk` and
  `CurrentConditions`, but silently skipped at three other call sites added in the
  same session. A shared `effectiveAqi(aqiData)` utility would have made this
  structurally impossible to miss.
- **A silently-vanishing UI state is often worse than an ugly error message** —
  especially for a feature whose value proposition is "check this during an
  emergency." Any component that can render `null` on fetch failure should be
  checked for whether that failure mode is distinguishable from "nothing to show."
- **Grep for a bug's twin before considering it fixed.** The raw-vs-effective-AQI bug
  existed in 6 near-identical call sites across 2 files; fixing one instance without
  grepping for the pattern elsewhere would have left the rest silently broken.
