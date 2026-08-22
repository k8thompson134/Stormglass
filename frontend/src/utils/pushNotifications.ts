import {
  fetchPushPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
  fetchSecondaryAlertEnabled,
  setSecondaryAlertEnabled,
  fetchNotificationLog,
  type SecondaryAlertKind,
  type PushNotificationLogEntry,
} from "../services/api";

export const SECONDARY_ALERT_KINDS: SecondaryAlertKind[] = [
  "migraine",
  "mecfs",
  "pots",
  "clear-air",
];

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// The browser can silently drop a PushSubscription (Android background/battery
// cleanup, Chrome update, site data reset) without telling the app -- the app then
// finds itself with granted permission but no subscription, and previously that
// meant push just stayed off until someone happened to open Settings and retoggle
// it. These two flags record what the user actually asked for, independent of the
// current (possibly-lost) subscription, so a startup reconcile can restore it
// silently rather than requiring the user to notice and re-opt-in.
const PUSH_INTENT_KEY = "stormglass_push_intent";
const SECONDARY_INTENT_KEY: Record<SecondaryAlertKind, string> = {
  migraine: "stormglass_migraine_intent",
  mecfs: "stormglass_mecfs_intent",
  pots: "stormglass_pots_intent",
  "clear-air": "stormglass_clear_air_intent",
};

function setPushIntent(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(PUSH_INTENT_KEY, "1");
    else window.localStorage.removeItem(PUSH_INTENT_KEY);
  } catch {
    /* ignore persistence errors */
  }
}

function getPushIntent(): boolean {
  try {
    return window.localStorage.getItem(PUSH_INTENT_KEY) === "1";
  } catch {
    return false;
  }
}

function setSecondaryIntent(kind: SecondaryAlertKind, enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(SECONDARY_INTENT_KEY[kind], "1");
    else window.localStorage.removeItem(SECONDARY_INTENT_KEY[kind]);
  } catch {
    /* ignore persistence errors */
  }
}

function getSecondaryIntent(kind: SecondaryAlertKind): boolean {
  try {
    return window.localStorage.getItem(SECONDARY_INTENT_KEY[kind]) === "1";
  } catch {
    return false;
  }
}

// The VAPID public key comes back from the server as URL-safe base64; PushManager
// wants it as a raw Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushEnableResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "not-configured" | "permission-denied" | "error";
    };

/**
 * Requests Notification permission (must be called from a direct user gesture --
 * browsers block auto-prompting) and, if granted, subscribes this browser to push
 * and registers it with the backend.
 *
 * `Notification.requestPermission()` is called FIRST, before any other `await` --
 * Chrome treats "sticky user activation" as consumed by the first async gap, so an
 * intervening network fetch (e.g. for the VAPID key) before this call makes Chrome
 * silently suppress the prompt (no dialog, permission stays 'default' forever)
 * instead of erroring, which is a much more confusing failure mode than it sounds.
 */
export async function enablePushNotifications(): Promise<PushEnableResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return { ok: false, reason: "permission-denied" };

  const publicKey = await fetchPushPublicKey();
  if (!publicKey) return { ok: false, reason: "not-configured" };

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await subscribeToPush(subscription.toJSON() as PushSubscriptionJSON);
    setPushIntent(true);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function disablePushNotifications(): Promise<void> {
  setPushIntent(false);
  SECONDARY_ALERT_KINDS.forEach((kind) => setSecondaryIntent(kind, false));
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  try {
    await unsubscribeFromPush(endpoint);
  } catch {
    // Browser-side unsubscribe already succeeded -- a failed backend cleanup call
    // just leaves a stale row that a future 410 from web-push will clear anyway.
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

// Each secondary alert (migraine, ME/CFS, POTS, clean-air) is a separate opt-in,
// scoped to this device's subscription endpoint, so it can only be read/changed
// while push itself is enabled.
export async function getSecondaryAlertEnabled(
  kind: SecondaryAlertKind,
): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  return fetchSecondaryAlertEnabled(kind, subscription.endpoint);
}

export async function toggleSecondaryAlert(
  kind: SecondaryAlertKind,
  enabled: boolean,
): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await setSecondaryAlertEnabled(kind, subscription.endpoint, enabled);
  setSecondaryIntent(kind, enabled);
  return true;
}

/**
 * Restores push notifications after either the browser or the backend has dropped
 * its half of the subscription -- run this on every app load. Two distinct failure
 * modes land here: (1) the browser silently drops the subscription (permission
 * still 'granted' but PushManager has nothing), which needs a fresh
 * `pushManager.subscribe()` -- that itself doesn't need a user gesture (only
 * `requestPermission()` does), so this can re-subscribe without prompting anyone;
 * (2) the backend row gets deleted independently (e.g. a 404/410 cleanup from a
 * failed send) while the browser subscription is still perfectly valid, which
 * this function would never notice or repair unless it re-upserts with the
 * backend unconditionally, not just when a new browser-side subscription had to
 * be created. A fresh or re-upserted subscription is a brand new server-side row
 * (`aqiAlertsEnabled` defaults true, every secondary alert defaults false) -- the
 * locally stored intent flags are what let this also restore whichever secondary
 * alerts (migraine, ME/CFS, POTS, clean-air) were opted into, instead of silently
 * losing them.
 *
 * No-ops entirely if the user never opted in (no push intent stored) or permission
 * isn't 'granted' -- this only repairs an existing opt-in, it never creates a new
 * one, since that still requires the user-gesture-gated permission prompt.
 */
export async function reconcilePushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  if (!getPushIntent()) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await fetchPushPublicKey();
      if (!publicKey) return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    // Always upsert with the backend, even when the browser already had a live
    // subscription -- the backend row can be deleted independently of the browser
    // subscription (e.g. sendToSubscription's 404/410 cleanup after ANY alert type
    // fails to deliver), and without this, a device in that state would silently
    // stop receiving every push notification forever: the browser subscription
    // still looks fine, so this function would never get past the `if (!subscription)`
    // branch to recreate the missing backend row.
    await subscribeToPush(subscription.toJSON() as PushSubscriptionJSON);
    for (const kind of SECONDARY_ALERT_KINDS) {
      if (getSecondaryIntent(kind)) {
        await setSecondaryAlertEnabled(kind, subscription.endpoint, true);
      }
    }
  } catch {
    // Best-effort -- next app load (or opening Settings) tries again.
  }
}

export async function getNotificationLog(): Promise<
  PushNotificationLogEntry[]
> {
  if (!isPushSupported()) return [];
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return [];
  return fetchNotificationLog(subscription.endpoint);
}
