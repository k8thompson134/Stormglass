# Visual QA for the AQI forecast + safe-window UI — DONE

Originally written as a handoff for a session with browser-extension access, since this
session's claude-in-chrome extension wasn't connecting (only one session can hold that
connection at a time). Resolved instead by driving a local Playwright install directly
(`npx playwright` — browsers were already cached on this machine) against the Vite dev
server proxied at a local backend instance. Two real bugs were found and fixed as a
result — see bottom of this doc. The rest of the file is kept as-is for reference on how
the check was done, in case it's useful again.

## Result: 2 bugs found and fixed via visual QA

1. **"NOW" reference-line label wasn't visible** — clipped above the chart's plot area
   because the 180px-tall `ComposedChart` had no top margin for the label to render
   into. Fixed with `margin={{ top: 20, right: 4, left: 0, bottom: 0 }}` in
   `AQIForecastChart.tsx`.
2. **`?threshold=0` was silently ignored and fell back to the default 100** — backend
   used `parseInt(...) || 100`, and `0` is falsy in JS, so an explicit zero threshold
   got overridden right back to the default. Fixed in `weather.ts` with an explicit
   `Number.isNaN` check instead of `||`. Added a regression test
   (`backend/src/api/weather.test.ts`) so this can't silently regress.

All three callout states (current safe window, upcoming safe window, no safe window in
72h) were screenshotted and confirmed rendering correctly, along with a 390px mobile
width check (no horizontal overflow, layout wraps cleanly). Full sweep after fixes:
109/109 backend tests, both typechecks clean, `git diff --stat frontend/vite.config.ts`
confirmed empty (temporary port-proxy edit used for local testing was reverted).

## What to look at

New component: `frontend/src/components/AQIForecastChart.tsx`, rendered in `App.tsx`
right below the pressure chart / current-conditions row (gated on the AQI health toggle
being on — check Settings if you don't see it).

It shows:
1. A callout at the top answering "when can I go outside" — one of three states:
   - Green: "Clear now — safe through [time]" (currently in a safe window)
   - Green: "Next clear window: [start] – [end]" (not currently safe, but one's coming)
   - Orange: "No safe window in the next 72h" (genuinely bad stretch ahead)
2. A 72h AQI area chart below it, with:
   - Light green shading over the safe-window stretches (should visually line up with
     the callout text)
   - Dashed reference lines at AQI 100/150/200
   - A "NOW" marker
   - A peak-forecast badge in the top-right if the 72h peak is notably worse than now

## What to check

- **Does the shading actually align with the callout text?** e.g. if the callout says
  "safe through 6pm," the green shading should end right around the 6pm gridline.
- **Light and dark mode** — the app is dark-theme by default; not sure if there's a light
  mode, check `frontend/src/index.css` / tailwind config if unsure.
- **Mobile width** — the card should not overflow horizontally; the callout text wraps
  reasonably; the chart's `ResponsiveContainer` should not squash awkwardly.
- **The "no safe window" state** — this one's hard to trigger with current real data
  (air quality has been decent this week), so it's essentially unverified visually. You
  can force it by temporarily calling the endpoint with a very low threshold, e.g.
  `/api/weather/aqi-forecast?threshold=10`, and eyeballing what the frontend *would* look
  like if you swap `fetchAQIForecast()` in `AQIForecastChart.tsx` to pass `10` — just
  don't leave that hardcoded.
- **Tooltip on hover** — confirm it shows AQI + PM2.5 and the "FORECAST" tag appears only
  for future points, not past ones.
- General vibe check: does the callout read naturally, or does anything sound like a
  template string didn't fill in right (e.g. "NaN%", "undefined", broken pluralization)?

## How to run it locally

Port 3000 is occupied by another container on this machine (`open-webui`), so the
backend needs an alternate port and Vite's proxy needs to point at it:

```bash
cd backend && PORT=3901 npm run dev   # backend, real prod DB via backend/.env (gitignored, already configured)
```

Then temporarily edit `frontend/vite.config.ts` — both proxy targets from
`localhost:3000` to `localhost:3901` — before running:

```bash
cd frontend && npm run dev            # http://localhost:5173
```

**Revert `vite.config.ts` before finishing** — it's a real committed file, the port
change was only ever a local workaround for this sandboxed environment's port conflict.
Confirm with `git diff --stat frontend/vite.config.ts` (should be empty) before you're done.

Note: `backend/.env` points at the **real production Railway Postgres DB** — running the
backend locally runs a real poll cycle against it (same as production does every 30 min
anyway, so it's safe, just worth knowing it's not a sandbox DB).

## Context if you want it

Full history: `docs/AQI_WILDFIRE_SMOKE_CONTEXT.md` (what was built) and
`docs/AQI_WILDFIRE_SMOKE_TESTING_PLAN.md` (testing done + Part 2 feature additions,
including this one — "B: safe window framing" — and what's still open: C/D/E/F).
