import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { env } from '../env.js';
import { logger } from '../logger.js';

const vapidConfigured = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
} else {
  logger.info({ service: 'push' }, 'VAPID keys not configured -- push notifications disabled');
}

export function isPushConfigured(): boolean {
  return vapidConfigured;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface AqiAlertPayload {
  toCategory: string;
  usAqi: number;
  at: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/**
 * Sends one push notification to one subscription, cleaning up (deleting) the row
 * if the push service reports it gone -- a 404/410 from sendNotification means the
 * browser unsubscribed or the endpoint expired, and retrying it forever would be
 * silent waste. Returns whether the send actually succeeded, so callers that need
 * to know (e.g. the subscribe route confirming setup worked) can react to it.
 */
async function sendToSubscription(sub: SubscriptionRow, payload: NotificationPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      logger.info({ service: 'push', subscriptionId: sub.id }, 'Subscription gone -- removing');
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    } else {
      logger.error({ service: 'push', err, subscriptionId: sub.id }, 'Failed to send push notification');
    }
    return false;
  }
}

/**
 * Sends the AQI category-crossing alert to every subscription opted into it.
 */
export async function sendAqiCrossingAlert(payload: AqiAlertPayload): Promise<void> {
  if (!vapidConfigured) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.aqiAlertsEnabled, true));

  const body = `Forecast crosses into ${payload.toCategory} around ${new Date(payload.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (AQI ${payload.usAqi})`;

  await Promise.all(
    subs.map(async (sub) => {
      // Dedup: only resend once the crossing resolves to a DIFFERENT category than
      // what this device was last notified about -- see schema.ts's comment on
      // lastNotifiedCategory for why this lives per-subscription.
      if (sub.lastNotifiedCategory === payload.toCategory) return;

      const sent = await sendToSubscription(sub, { title: 'Air quality worsening', body, tag: 'aqi-category-crossing', url: '/' });
      if (sent) {
        await db
          .update(pushSubscriptions)
          .set({ lastNotifiedCategory: payload.toCategory })
          .where(eq(pushSubscriptions.id, sub.id));
      }
    })
  );
}

/**
 * Sends a one-time confirmation push right after a subscription is created --
 * both a friendly "you're all set up" moment and a real, immediate end-to-end test
 * of the exact delivery path the AQI alert will later use, rather than the user's
 * first real confirmation being a silent no-op days later when AQI actually crosses
 * a category.
 */
export async function sendWelcomeNotification(sub: SubscriptionRow): Promise<boolean> {
  if (!vapidConfigured) return false;
  return sendToSubscription(sub, {
    title: "You're all set up!",
    body: "Stormglass will alert you here when air quality is forecast to worsen.",
    tag: 'push-welcome',
    url: '/',
  });
}

/**
 * Clears the dedup state for every subscription once the forecast no longer shows
 * an upcoming category crossing -- otherwise if air quality improves and later
 * crosses into the same category again, that second crossing would be silently
 * skipped as "already notified."
 */
export async function clearAqiCrossingDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedCategory: null })
    .where(eq(pushSubscriptions.aqiAlertsEnabled, true));
}
