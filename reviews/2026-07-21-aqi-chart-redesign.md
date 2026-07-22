# QA Review: AQI Chart Redesign + Follow-up Improvements

**Date:** 2026-07-21 (follow-up round, same day as the earlier
`2026-07-21-aqi-wildfire-smoke.md` review)
**Mode:** Feature review (no args)
**Scope:** PurpleAir caching (improvement #1), low-confidence sensor caveat (#2),
timezone-aware burden grouping + the location-timezone persistence fix (#5), the
push-notification scoping doc (not code), and the `AQIForecastChart` redesign
(PressureChart-style time-range switcher, forecast/PM2.5 toggles, dual-axis lines,
the forecast-window scaling fix, and a copy-tone revision).

## 1. Error paths

Unchanged from the prior review — `AQIForecastChart`/`AQISeasonSummary` already
distinguish a real fetch failure from "no data yet," `purpleair.ts` degrades cleanly.
No new gaps introduced by this round's changes.

**Worth naming, not fixing:** the new PurpleAir cache (`purpleair.ts`) caches a
`null` result (fetch failure) for the same 60-minute TTL as a successful one. During
a real PurpleAir outage, this means the app won't retry for up to an hour even after
PurpleAir recovers — a deliberate tradeoff (prevents retry storms during an outage)
that's reasonable for a personal health tool, but worth knowing: a transient blip can
suppress the hyperlocal overlay for longer than the outage itself lasted.

## 2. Loading / pending states

`AQIForecastChart`'s `hours` switcher correctly sets `loading=true` on every range
change (verified in code: the `useEffect` depends on `hours` and resets loading
before the fetch), replacing the whole card with the pulsing skeleton rather than
showing a stale/mismatched chart mid-fetch.

## 3. Third-party-service-down handling

No changes to this behavior in this round beyond what was already reviewed.

## 4. Schema / migration completeness

No new schema/migration in this round (the `users.name`/`timezone` column and its
migration were covered in the prior review). Confirmed still applied and consistent
via a fresh query against production during this review.

## 5. Consistency across touchpoints — 1 bug found and fixed

**Found and fixed, verified live:** the data-summary bar's "72h peak" label was
stale. Before the forecast-window scaling fix, `AQIForecastChart`'s underlying data
always spanned the full 72h regardless of the selected history range, so "72h peak"
was accurate. After decoupling the chart's own series from the fixed 72h window (so
a 6h view pairs with a ~6h forecast, matching PressureChart), the visible data at
`hours=6` only spans ~11h — but the label still said "72h peak," which was now
simply false. Confirmed live: at `hours=6` the returned series spanned
`2026-07-21T19:00Z → 2026-07-22T06:00Z` (~11h), yet the UI would have shown "72h
peak: 59." Fixed by dropping the hardcoded window qualifier ("Peak: 59"), matching
how PressureChart's analogous "Swing:" stat doesn't hardcode a time window either —
the adjacent date-range text already communicates the actual window.

**Checked, not a real issue:** whether the safe-window shading could visually
contradict the callout text (callout always reflects the true 72h outlook; the chart
shading is clamped to whatever's currently visible, which can be much shorter at
small `hours` selections). Verified live via screenshot — when the entire visible
window happens to be safe, the shading fills 100% of the visible chart edge-to-edge
with no visible "cutoff" marker, so there's nothing that reads as contradictory in
practice. Not flagging this as a bug.

## 6. Docs

**Found and fixed:** `docs/AQI_WILDFIRE_SMOKE_TESTING_PLAN.md` didn't mention any of
this round's work (the three improvements, the scoping doc, or the chart redesign).
Added a "Post-D/E/F follow-up round" section summarizing all of it with pointers to
this review file and the push-notification scoping doc.

## 7. Honesty check — what got cut

- Push notifications (#3) — scoped only, not built, per explicit instruction. Added
  to the lair task board (#226) as previously confirmed.
- Porting frontend's "sustained pressure trend" migraine logic to backend (#4) —
  explicitly deferred by the user ("needs a little more planning"), still open,
  untouched this round.
- The PurpleAir cache's failure-caching tradeoff (see Error paths above) — not a cut
  corner exactly, but a real behavior worth knowing rather than assuming "cached
  means always fresher."

## 8. Security sanity

No new user input surfaces beyond what the prior review covered. The new
`timezone` field in `POST /api/settings/location` is validated via
`Intl.DateTimeFormat` before being allowed anywhere near a DB write (confirmed via
both live testing and new automated tests — see below); an invalid value is
logged and silently dropped from the update rather than either erroring or
persisting garbage.

## Test coverage gap found and closed

**Found:** `backend/src/api/settings.ts` had zero automated test coverage —
including the pre-existing location-update/geocode-proxy logic, and the new
timezone-validation logic added this session. This is a real gap: I'd verified the
timezone behavior live (correct: invalid timezone rejected without erroring,
existing valid value left untouched) but that verification would have been silently
lost the moment the code changed again, with nothing to catch a regression.

**Fixed:** added `backend/src/api/settings.test.ts` (6 new tests) covering: valid
timezone persists, invalid timezone is dropped (not persisted, not erroring),
omitted timezone leaves the update untouched, location/name still update even when
timezone is invalid, out-of-range coordinates 400 before any DB write, and a 500 when
polling hasn't started yet without touching the DB. All 6 passed on the first run,
confirming the earlier live-verified behavior was already correct.

151/151 backend tests passing (145 + 6 new), both typechecks clean, verified live
against production data and visually via Playwright.

---

## Bugs / defects — ranked

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | "72h peak" label went stale after the forecast-window scaling fix (fixed) | medium | xs | P0 |
| 2 | `settings.ts` had zero test coverage, including new timezone logic (fixed) | medium | s | P1 |

## Improvements — ranked

| # | Improvement | Value | Effort | Priority |
|---|-------------|-------|--------|----------|
| 1 | Retry PurpleAir sooner than the full 60min TTL after a cached failure (e.g. a shorter failure-only TTL) | low | xs | P3 |
| 2 | Port frontend's "sustained pressure trend" migraine logic to backend (still open from last review) | medium | m | P2 |

---

## Candidate learnings

- **A derived/computed label (like "72h peak") needs to be re-checked whenever the
  underlying data window it describes changes shape.** This bug existed because the
  window-scaling fix and the label were written in the same sitting but the label
  wasn't re-derived from the new window logic — an easy miss when a hardcoded string
  and a dynamic calculation drift apart silently (no type error, no test failure,
  just a wrong number in production).
- **"No test file exists for X" is itself a review finding, not just an opportunity.**
  `settings.ts` sat with zero coverage through several sessions of edits; treating an
  untested file as lower priority to check meant real new logic (timezone validation)
  landed with no safety net until this review went looking for it specifically.

Given how small and clearly-scoped both learnings are, and how much they resemble
`[[feedback_grep_for_bugs_twin]]` (already saved from the prior review) — recommend
persisting the label-drift one as a distinct, complementary lesson.
