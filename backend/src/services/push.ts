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

/**
 * Sends the AQI category-crossing alert to every subscription opted into it,
 * skipping (and clearing) any subscription the push service reports as gone --
 * a 404/410 from sendNotification means the browser unsubscribed or the endpoint
 * expired, and re-sending to it every poll cycle forever would be silent waste.
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

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'Air quality worsening',
            body,
            tag: 'aqi-category-crossing',
            url: '/',
          })
        );
        await db
          .update(pushSubscriptions)
          .set({ lastNotifiedCategory: payload.toCategory })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          logger.info({ service: 'push', subscriptionId: sub.id }, 'Subscription gone -- removing');
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          logger.error({ service: 'push', err, subscriptionId: sub.id }, 'Failed to send push notification');
        }
      }
    })
  );
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
