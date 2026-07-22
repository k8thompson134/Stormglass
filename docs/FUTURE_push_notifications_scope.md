# Future task: Push notifications (opt-in, app-wide)

**Status:** Scoped, not started. Explicitly deferred to ship the AQI/smoke work first.
Written 2026-07-21 as a quick scoping pass for the task board, not a detailed plan.

## The idea

Extend the in-app-only category-crossing banner (built this session) into an actual
push notification, so "AQI crosses into Unhealthy around 5pm" reaches you without
having to open the app. Then generalize the same delivery mechanism to other
conditions over time (safe-window ending, other health-risk severity changes),
opt-in per-alert-type via Settings/Onboarding — matching the existing `healthToggles`
pattern already used for which conditions show up in Health Impact.

## The one thing that changes the shape of this: how you actually use the app

You're using Stormglass as a **regular browser tab over Tailscale** (confirmed this
session), not an installed PWA. This matters a lot:

- **iOS Safari only supports Web Push for installed PWAs** ("Add to Home Screen"),
  not regular browser tabs, since iOS 16.4. If you stay in a browser tab, push
  notifications silently won't work on iPhone no matter how correctly the backend
  is built.
- Android Chrome supports Web Push in a regular tab, no install required.
- Desktop Chrome/Firefox/Edge support it in a regular tab too.

**First decision before building anything:** are you willing to "Add to Home Screen"
on your phone (one-time, ~10 seconds), or does this need to work in a plain browser
tab? If the latter, Web Push is off the table for iOS and the realistic options are
much narrower (e.g. a scheduled SMS/email digest instead, which is a different and
probably simpler build). This alone is worth a real answer before scoping the rest.

## Rough shape (assuming Web Push, installed PWA is acceptable)

**Backend, new:**
- VAPID key pair (generated once, stored in `.env` — public key also needed by frontend)
- `push_subscriptions` table: one row per browser/device subscription (endpoint, keys, which alert types it's opted into)
- `POST /api/push/subscribe` — save a subscription from the frontend
- A send path: when `weather-poll.ts`'s cron cycle computes a new `categoryCrossing` (or later, other alert conditions), compare against the last-sent state (don't resend the same alert every 30 min) and push via `web-push` npm package to all subscribed devices

**Frontend, new:**
- Settings/Onboarding: a per-alert-type opt-in toggle (start with just "Air quality alerts", extend later), gated behind `Notification.requestPermission()` — must be a direct user gesture (a button click), browsers block auto-prompting
- Service worker: a `push` event handler (the existing `vite-plugin-pwa` setup already generates a service worker; this adds a handler to it) to actually display the notification
- Subscribe on toggle-on, unsubscribe (and tell the backend) on toggle-off

**MVP scope for a first version:**
- Just the category-crossing AQI alert (D), one alert type, no per-severity tuning
- Skip: quiet hours, digest/batching, other conditions — those are the "extend it throughout" part, explicitly a later iteration

## Rough effort

Medium-large for the MVP (new table + endpoint + service worker changes + permission
UX, which is fiddly to get right across browsers), larger again to actually extend to
"throughout" once the pattern's proven. Not a quick add — the reason this was deferred
was correct.

## Open questions for whoever picks this up

1. Home-screen-install answer from above — blocks whether Web Push is even viable on iOS.
2. Where does the "don't resend the same alert repeatedly" state live — a new column, or reuse something?
3. Does this ever need to reach a second device/person, or is it always just you? (Affects whether `push_subscriptions` needs a user_id at all vs. being effectively global.)
