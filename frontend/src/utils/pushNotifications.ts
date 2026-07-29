import { fetchPushPublicKey, subscribeToPush, unsubscribeFromPush } from '../services/api';

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// The VAPID public key comes back from the server as URL-safe base64; PushManager
// wants it as a raw Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export type PushEnableResult =
  // `welcomeSent` distinguishes "subscribed, and we confirmed delivery works" from
  // "subscribed, but the confirmation push itself failed" -- both leave you
  // correctly enrolled, but only one should show an unqualified success message.
  | { ok: true; welcomeSent: boolean }
  | { ok: false; reason: 'unsupported' | 'not-configured' | 'permission-denied' | 'error' };

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
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission-denied' };

  const publicKey = await fetchPushPublicKey();
  if (!publicKey) return { ok: false, reason: 'not-configured' };

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const { welcomeSent } = await subscribeToPush(subscription.toJSON() as PushSubscriptionJSON);
    return { ok: true, welcomeSent };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function disablePushNotifications(): Promise<void> {
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
  if (Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}
