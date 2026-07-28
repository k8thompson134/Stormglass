# QA Review — AQI EPA Scale Fix + Sensitivity Settings

Feature mode. Target: the full AQI overhaul from this session (commits `07dc422`..`eab61dc` — EPA category scale correction, graduated nuance in other risk scores, dynamic risk-card states, and the Settings/onboarding sensitivity preference). `fbf1db6` (doc cleanup) excluded as unrelated.

## Error paths / loading states / third-party-down handling

Nothing new introduced here needed review — no new async calls or third-party dependencies were added this session. Existing patterns (AQIForecastChart's loading/error states, AQISeasonSummary's error state) were left intact and still work correctly with the new `sensitivity` prop.

## Consistency across touchpoints

**Real bug found:** `AQISeasonSummary` was never wired to the user's `aqiSensitivity` preference. `App.tsx` renders `<AQISeasonSummary />` with no props, and the component calls `fetchAQIBurden()` with no arguments — so its headline ("X of Y days have hit AQI **100**+") always uses the backend's hardcoded default threshold, even after `AQIForecastChart`, `SafeWindowCallout`, and the Settings picker all correctly reflect a user's chosen "Good only" (50) or "Sensitive-OK" (150) threshold. Someone who sets "Good only" will see the chart callout say "Currently Good or better" right above a season summary still talking about AQI 100+. This is the exact kind of drift the sensitivity feature was built to eliminate, just missed in one component.

## Honesty check — what got cut / simplified

- **AQISeasonSummary threshold wiring** — silently not carried through when the sensitivity setting was built. Not a deliberate cut, just a missed consumer (see bug #1 below).
- **No direct unit tests** were added for the three new exported utility functions (`aqiSeverityFactor`, `aqiScoreBump`, `categoryCeiling`) — they're only exercised indirectly through `getMigraineRisk`/`getPOTSRisk`/etc. tests, which happen to cover them but don't pin their boundary behavior directly.
- **docs/api-specs/API.md** still doesn't document `/api/weather/aqi-forecast`, `/api/weather/aqi-burden`, the new `?category=` param, or the `byCategory` response field. This gap pre-dates this session (flagged in an earlier doc-cleanup pass) but is still open.
- **Zero frontend test files exist anywhere in the project** (confirmed via `find`). Pre-existing project-wide condition, not introduced this session, but worth naming explicitly per this project's own review convention rather than only noting in passing — a real, currently-shipping feature (the whole AQI sensitivity flow: onboarding step, Settings toggle, one-time announcement, opt-in/out) has no automated coverage at all on the frontend side.

## Basic security sanity

The one new user-input surface is `?category=` on `/api/weather/aqi-forecast` (`backend/src/api/weather.ts`). It's validated with `CATEGORY_ORDER.find(c => c === request.query.category)` — strict equality against a fixed whitelist — before being used only to compute a numeric threshold. No SQL/shell/path exposure. Fine.

## Bugs found

### 1. AQISeasonSummary ignores the user's AQI sensitivity setting
`frontend/src/components/AQISeasonSummary.tsx` calls `fetchAQIBurden()` with no threshold; `frontend/src/App.tsx` renders it with no props. It always reports against the backend's default (AQI 100), even when the user has set "Good only" or "Sensitive-OK" everywhere else (chart callout, Settings, announcement). Confirmed via source read of both files — `AQISeasonSummary` and its `App.tsx` call site take zero sensitivity-related props today.

**Fix shape:** pass `sensitivity={aqiSensitivity}` into `<AQISeasonSummary>` the same way it's already passed into `<AQIForecastChart>`, look up the matching `ceiling` from `AQI_SENSITIVITY_OPTIONS`, and pass it to `fetchAQIBurden(undefined, ceiling)`.

### 2. HealthImpact's new "top recommendation" feature surfaces a generic filler instead of the actionable tip for several conditions
`frontend/src/components/HealthImpact.tsx`'s `RiskCard` now shows `risk.recommendations[0]` directly on high/severe cards (the "dynamic state" feature added this session). That assumes index 0 is always the most actionable, severity-specific recommendation — true for `getMigraineRisk`/`getMECFSRisk` (which build their recommendation list from `RiskConfig` thresholds, already ordered most-specific-first), but **not** true for `getPOTSRisk`: its array is built as `['Stay hydrated', 'Monitor symptoms', ...conditional]`, so even at `severe` risk with a real stressor-specific tip available (e.g. "Stay in the coolest comfortable environment you can"), that tip lands at index 2, and the card always shows the generic "Stay hydrated" instead. `getJointPainRisk`, `getFibromyalgiaRisk`, and `getSinusRisk` have similar static (non-severity-tiered) arrays, so the "dynamic" framing doesn't actually vary by severity for those conditions either — less broken than POTS (their first items are at least concretely actionable), but not truly dynamic.

**Fix shape:** either reorder POTS's array (severity-specific tip first, generic filler after), or change `topRecommendation` to skip past known-generic leaders, or accept that only Migraine/MECFS get true severity-tiered top-recommendations for now and scope the feature description accordingly.

## Candidate learnings

- When a new "recommendations[0] is the headline" UI pattern is built on top of existing recommendation arrays, verify that assumption against *every* consumer's array construction, not just the one you were looking at when you designed the feature — array ordering that was fine for a hidden list ("Recommendations" section in a modal) can become a correctness bug the moment something starts reading index 0 specifically.
- When a new user preference (like `aqiSensitivity`) is threaded through one component (`AQIForecastChart`), grep for *every* other consumer of the same underlying data family (`fetchAQIBurden`/`fetchAQIForecast`) before considering the wiring complete — sibling components calling the same API family are easy to miss since they don't show up in the same file you're actively editing.

## Bugs / defects — ranked

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | AQISeasonSummary ignores user's AQI sensitivity setting, always shows AQI 100+ | medium | s | P1 |
| 2 | HealthImpact's top-recommendation feature shows generic "Stay hydrated" instead of severity-specific advice for POTS | medium | s | P1 |

## Improvements — ranked

| # | Improvement | Value | Effort | Priority |
|---|-------------|-------|--------|----------|
| 1 | Direct unit tests for aqiSeverityFactor/aqiScoreBump/categoryCeiling boundaries | medium | xs | P1 |
| 2 | Update README's Air Quality section to mention category breakdown + configurable threshold | low | xs | P2 |
| 3 | Document aqi-forecast/aqi-burden/briefing endpoints (incl. `?category=`) in API.md | low | m | P3 |
| 4 | Add frontend test infra (currently zero test files project-wide) | medium | l | P3 |
