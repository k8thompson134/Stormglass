# Push notifications (opt-in, app-wide)

**Status: MVP built (2026-07-29).** Written 2026-07-21 as a quick scoping pass;
resolved 2026-07-28 (Android, not iOS — Web Push works in a plain browser tab, no
install needed); built 2026-07-29 exactly to the "Rough shape" below, MVP scope only
(AQI category-crossing alert, one alert type). Verified end-to-end: subscribing
persists a real `push_subscriptions` row (backed by Google's FCM), and a real send
via `sendAqiCrossingAlert` succeeds against it. Extending to other conditions
(safe-window ending, other severity changes) is still a later iteration -- see
"MVP scope" below, unchanged from the original plan.

## The idea

Extend the in-app-only category-crossing banner (built this session) into an actual
push notification, so "AQI crosses into Unhealthy around 5pm" reaches you without
having to open the app. Then generalize the same delivery mechanism to other
conditions over time (safe-window ending, other health-risk severity changes),
opt-in per-alert-type via Settings/Onboarding — matching the existing `healthToggles`
pattern already used for which conditions show up in Health Impact.

## The one thing that changes the shape of this: how you actually use the app

You're using Stormglass as a **regular browser tab over Tailscale** (confirmed this
session), not an installed PWA. This mattered a lot when the phone in question was
assumed to be an iPhone -- **resolved 2026-07-28: it's Android**, which sidesteps
the whole problem:

- iOS Safari only supports Web Push for installed PWAs ("Add to Home Screen"), not
  regular browser tabs, since iOS 16.4 -- this would have blocked a plain-tab setup
  entirely on iPhone. Not a concern here.
- **Android Chrome supports Web Push in a regular tab, no install required** -- this
  is the actual platform in use, so Web Push works as-is, no "Add to Home Screen"
  decision needed.
- Desktop Chrome/Firefox/Edge support it in a regular tab too.

## Rough shape (Web Push -- viable as-is, no PWA install needed on Android)

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

1. ~~Home-screen-install answer from above — blocks whether Web Push is even viable on iOS.~~
   **Resolved 2026-07-28:** Android, plain browser tab, Web Push works with no install step.
2. Where does the "don't resend the same alert repeatedly" state live — a new column, or reuse something?
3. Does this ever need to reach a second device/person, or is it always just you? (Affects whether `push_subscriptions` needs a user_id at all vs. being effectively global.)
