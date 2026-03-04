# Code Review — Remaining Items & Plan

This document lists what was **not yet addressed** from the pre-deployment code review, and a concrete plan to tackle them. Items already fixed (high/medium) are not repeated.

---

## Already addressed (summary)

- **High:** Backend `npm audit fix` (minimatch ReDoS).
- **Medium:** WebSocket documented as public; stricter rate limit for `/api/geocode`; weather poll parallelized; shared `SEVERITY_THEME`; `useFocusTrap` hook; Sidebar `aria-label`s; README Environment Variables section.
- **Quick wins (done):** L3 SW console gated by DEV; L9 ErrorBoundary `role="alert"` + `aria-live="assertive"`; L12 `backend/.env.example` added.
- **Docs & API (done):** L10 `docs/api-specs/API.md` added; L11 JSDoc on health types.
- **M1 (done):** Contrast improved — gray-500/600/700 bumped to gray-400/500 across App, CurrentConditions, PressureChart, Settings, HealthImpact.

---

## Remaining by severity

### Medium (fix soon)


| #   | Phase | Item                                                                 | Action                                                                                                                                       |
| --- | ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | A11y  | **Color contrast** — Some gray-on-dark text may be close to WCAG AA. | ✅ Done: bumped gray-500/600/700 → gray-400/500. Re-run Lighthouse/axe to confirm. |


### Low (nice to have)


| #   | Phase    | Item                                                                         | Action                                                                                                                                                                                 |
| --- | -------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Security | **CSP** — No explicit Content-Security-Policy.                               | Add CSP via `@fastify/helmet` (e.g. `contentSecurityPolicy: { directives: { defaultSrc: ["'self']", ... } }`) once you know script/style sources.                                      |
| L2  | Security | **Log sinks** — Ensure production logs don’t expose internals.               | Document in deployment runbook: restrict log file/service access; avoid logging full request bodies or tokens.                                                                         |
| L3  | Perf     | **main.tsx console** — Service worker registration logs in production.       | Gate `console.log` / `console.error` for SW registration behind `import.meta.env.DEV` so production builds stay quiet.                                                                 |
| L4  | Perf     | **Pressure derivatives** — Re-scans last 7 days every poll.                  | (Medium-term.) Track “last processed timestamp” per user/location and only compute derivatives for new readings.                                                                       |
| L5  | Perf     | **History API** — 2000-row cap is fine; revisit if UI gets slow.             | Optional: per-timeframe limit or server-side downsampling for very long ranges.                                                                                                        |
| L6  | Quality  | **Sidebar** — Component exists but is not used in `App`.                     | ✅ Done: removed unused `frontend/src/components/Sidebar.tsx`.                                                                                                                        |
| L7  | Quality  | **Magic numbers** — AQI bands, POTS scoring, etc.                            | Continue centralizing in config objects (e.g. `frontend/src/utils/constants.ts` or alongside existing risk configs).                                                                   |
| L8  | Quality  | **ErrorBoundary** — Only logs to console.                                    | Optional: add `role="alert"` on the error UI container; later, send errors to a monitoring service or log with a stable error ID.                                                      |
| L9  | A11y     | **ErrorBoundary** — Error state not explicitly labeled for AT.               | ✅ Done: `role="alert"` and `aria-live="assertive"` on error container.                                                                                                                  |
| L10 | Docs     | **API specs** — Ensure `docs/api-specs` (or equivalent) matches real routes. | ✅ Done: `docs/api-specs/API.md` with routes, auth, errors.                                                                                                                             |
| L11 | Docs     | **JSDoc on shared types** — HealthRisk, RiskLevel, HealthToggles.            | ✅ Done: JSDoc in `frontend/src/types/health.ts`.                                                                                                                                       |
| L12 | Docs     | **.env.example** — README says `cp backend/.env.example backend/.env`.       | ✅ Done: added `backend/.env.example`.                                                                                                                                                  |
| L13 | Deploy   | **/health** — Currently only returns `{ status, timestamp }`.                | Optional: add a cheap DB check (e.g. `SELECT 1`) and include `db: 'ok'                                                                                                                 |
| L14 | Deploy   | **CI** — Ensure production build is required to pass.                        | Add or confirm a CI step that runs `npm run build` in both frontend and backend and fails the pipeline on errors.                                                                      |


---

## Suggested order of work

1. **Quick wins (single PR)**
  - **L3:** Gate SW registration console in `main.tsx`.  
  - **L9:** Add `role="alert"` to ErrorBoundary error container.  
  - **L12:** Add `backend/.env.example` (or align README with existing `.env.example`).
2. **Docs & API (one PR)**
  - **L10:** Add or update API doc (method, path, auth, errors).  
  - **L11:** JSDoc on `HealthRisk`, `RiskLevel`, `HealthToggles`.
3. **A11y (one PR)**
  - **M1:** Run Lighthouse/axe; fix contrast where needed.
4. **Constants (optional PR)**
  - **L6:** ✅ Removed unused Sidebar.  
  - **L7:** Extract a few more constants (e.g. AQI bands) into a shared config.
5. **Later / ops**
  - **L1:** CSP when you finalize script/style sources.  
  - **L2:** Document log access in runbook.  
  - **L4, L5:** Performance tuning if you see load or latency issues.  
  - **L8:** ErrorBoundary monitoring when you have a logging/monitoring stack.  
  - **L13, L14:** Health check and CI as you harden deployment.

---

## Checklist (copy for PRs)

- [x] M1 — Contrast checked and fixed
- [x] L3 — SW console gated by DEV
- [x] L6 — Sidebar removed (was unused)
- [x] L9 — ErrorBoundary role="alert"
- [x] L10 — API doc updated
- [x] L11 — JSDoc on shared types
- [x] L12 — .env.example in backend or README fixed
- [ ] L13 — /health DB check (optional)
- [ ] L14 — CI runs frontend + backend build

