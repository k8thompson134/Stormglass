import webpush from 'web-push';
import { desc, eq, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions, pushNotificationLog } from '../db/schema.js';
import { env } from '../env.js';
import { logger } from '../logger.js';

type NotificationType = 'aqi' | 'aqi_current' | 'migraine' | 'welcome';
type NotificationOutcome = 'sent' | 'suppressed_dedup' | 'delivery_failed';

// A failure to WRITE the log entry must never take down the send path that
// triggered it (or, for the welcome push's un-awaited fire-and-forget call,
// crash the process via an unhandled rejection) -- logging is a side-channel,
// not something the alert's success should depend on.
async function logDecision(
  subscriptionId: string,
  type: NotificationType,
  outcome: NotificationOutcome,
  title: string,
  body: string,
  eventAt?: Date
): Promise<void> {
  try {
    await db.insert(pushNotificationLog).values({ subscriptionId, type, outcome, title, body, eventAt: eventAt ?? null });
  } catch (err) {
    logger.error({ service: 'push', err, subscriptionId }, 'Failed to write notification log entry');
  }
}

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

export interface CurrentAqiBadPayload {
  category: string;
  usAqi: number;
}

// Short, category-specific action rather than a generic "close your windows" for
// every severity -- what you'd actually do differs a lot between USG and Hazardous.
// Kept word-for-word identical (modulo the capitalization/punctuation each call site
// needs) to frontend/src/utils/aqiCategory.ts's CATEGORY_GUIDANCE -- verified in sync
// by backend/src/services/push.test.ts, which fails if the two ever say different
// things.
const CATEGORY_GUIDANCE: Record<string, string> = {
  'Unhealthy for Sensitive Groups': 'if you\'re sensitive to air quality, limit prolonged outdoor exertion',
  'Unhealthy': 'limit prolonged outdoor exertion',
  'Very Unhealthy': 'avoid outdoor exertion',
  'Hazardous': 'stay indoors and avoid outdoor exertion entirely',
};

// Ordinal so we can tell "risk went up" from "risk went down" -- unlike AQI category
// crossings (which only fire on worsening), migraine pressure risk has no natural
// forward-looking crossing helper, so dedup has to compare levels directly.
const RISK_ORDER: Record<string, number> = { low: 0, moderate: 1, high: 2, severe: 3 };

export interface MigraineRiskPayload {
  riskLevel: 'high' | 'severe';
  delta1h: number;
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

type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

interface DispatchAlertConfig {
  type: NotificationType;
  subsWhere: SQL;
  title: string;
  body: string;
  tag: string;
  eventAt?: Date;
  dedupKey: string;
  getLastNotified: (sub: PushSubscriptionRow) => string | null;
  isDuplicate: (lastNotified: string | null, dedupKey: string) => boolean;
  buildDedupUpdate: (dedupKey: string) => Partial<typeof pushSubscriptions.$inferInsert>;
}

/**
 * Shared fetch/dedup/send/log/update pipeline behind every alert type (AQI
 * category-crossing, AQI-bad-right-now, migraine risk) -- these three used to be
 * near-identical hand-copied functions; a bug fix to the pattern (e.g. this file's
 * fix for unhandled logDecision failures) previously had to be applied three times
 * by hand. New alert types register by calling this with their own dedup logic
 * instead of copy-pasting the loop.
 */
async function dispatchAlert(config: DispatchAlertConfig): Promise<void> {
  if (!vapidConfigured) return;

  const subs = await db.select().from(pushSubscriptions).where(config.subsWhere);

  await Promise.all(
    subs.map(async (sub) => {
      const lastNotified = config.getLastNotified(sub);
      if (config.isDuplicate(lastNotified, config.dedupKey)) {
        await logDecision(sub.id, config.type, 'suppressed_dedup', config.title, config.body, config.eventAt);
        return;
      }

      const sent = await sendToSubscription(sub, { title: config.title, body: config.body, tag: config.tag, url: '/' });
      await logDecision(sub.id, config.type, sent ? 'sent' : 'delivery_failed', config.title, config.body, config.eventAt);
      if (sent) {
        await db
          .update(pushSubscriptions)
          .set(config.buildDedupUpdate(config.dedupKey))
          .where(eq(pushSubscriptions.id, sub.id));
      }
    })
  );
}

/**
 * Sends the AQI category-crossing alert to every subscription opted into it.
 *
 * Dedup key is `category::date` (not just category) -- a plain category-only key
 * would silently suppress a genuinely new, later crossing into the same category if
 * the forecast never produced a "no crossing" cycle in between (the lookahead-window
 * gate in weather-poll.ts deliberately leaves dedup state untouched while a crossing
 * is real but not yet actionable, so two distinct crossings on different days could
 * otherwise resolve to the same stored value and the second would never fire).
 */
export async function sendAqiCrossingAlert(payload: AqiAlertPayload): Promise<void> {
  const guidance = CATEGORY_GUIDANCE[payload.toCategory];
  const body = `Forecast crosses into ${payload.toCategory} around ${new Date(payload.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (AQI ${payload.usAqi})${guidance ? ` -- ${guidance}` : ''}`;
  const dedupKey = `${payload.toCategory}::${payload.at.slice(0, 10)}`;

  await dispatchAlert({
    type: 'aqi',
    subsWhere: eq(pushSubscriptions.aqiAlertsEnabled, true),
    title: 'Air quality worsening soon',
    body,
    tag: 'aqi-category-crossing',
    eventAt: new Date(payload.at),
    dedupKey,
    getLastNotified: sub => sub.lastNotifiedCategory,
    isDuplicate: (last, key) => last === key,
    buildDedupUpdate: key => ({ lastNotifiedCategory: key }),
  });
}

/**
 * Sends a "air quality is bad right now" alert -- separate from the forecast
 * heads-up above, which only fires once for an upcoming crossing and can end up
 * silent by the time conditions are actually bad if that crossing was already
 * acknowledged earlier. This checks the CURRENT reading each poll and only
 * suppresses on an unchanged current category, so it stays accurate to what's
 * happening right now rather than a forecast made hours ago.
 */
export async function sendCurrentAqiBadAlert(payload: CurrentAqiBadPayload): Promise<void> {
  const guidance = CATEGORY_GUIDANCE[payload.category];
  const body = `Air quality is currently ${payload.category} (AQI ${payload.usAqi})${guidance ? ` -- ${guidance}` : ''}`;

  await dispatchAlert({
    type: 'aqi_current',
    subsWhere: eq(pushSubscriptions.aqiAlertsEnabled, true),
    title: 'Air quality is bad right now',
    body,
    tag: 'aqi-current-bad',
    dedupKey: payload.category,
    getLastNotified: sub => sub.lastNotifiedCurrentBadCategory,
    isDuplicate: (last, key) => last === key,
    buildDedupUpdate: key => ({ lastNotifiedCurrentBadCategory: key }),
  });
}

/**
 * Clears the "bad right now" dedup once current AQI drops back below the alerting
 * threshold, so a later re-entry into a bad category fires a fresh alert.
 */
export async function clearCurrentAqiBadDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedCurrentBadCategory: null })
    .where(eq(pushSubscriptions.aqiAlertsEnabled, true));
}

/**
 * Sends a migraine-risk alert to every subscription opted into it, only when the
 * risk level has gotten WORSE than what that device was last notified about --
 * pressure risk oscillates far more than AQI category, so a plain equality check
 * would miss re-alerting on high -> severe but also miss suppressing severe -> high
 * (an improvement) from re-firing the day risk drifts back up to high again.
 */
export async function sendMigraineRiskAlert(payload: MigraineRiskPayload): Promise<void> {
  const body = payload.riskLevel === 'severe'
    ? `Migraine risk is severe right now (pressure change ${payload.delta1h.toFixed(2)} hPa/hour) -- consider using rescue treatment early`
    : `Migraine risk is high right now (pressure change ${payload.delta1h.toFixed(2)} hPa/hour)`;

  await dispatchAlert({
    type: 'migraine',
    subsWhere: eq(pushSubscriptions.migraineAlertsEnabled, true),
    title: 'Migraine risk elevated',
    body,
    tag: 'migraine-risk',
    dedupKey: payload.riskLevel,
    getLastNotified: sub => sub.lastNotifiedMigraineRisk,
    isDuplicate: (last, key) => {
      const lastOrder = last ? (RISK_ORDER[last] ?? -1) : -1;
      return RISK_ORDER[key] <= lastOrder;
    },
    buildDedupUpdate: key => ({ lastNotifiedMigraineRisk: key }),
  });
}

/**
 * Clears migraine-risk dedup state once risk drops back to moderate/low, so a later
 * climb back into high/severe fires a fresh alert instead of being silently skipped
 * as "already notified."
 */
export async function clearMigraineRiskDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedMigraineRisk: null })
    .where(eq(pushSubscriptions.migraineAlertsEnabled, true));
}

// A push subscription needs a moment to fully settle with the push service (FCM)
// right after creation -- sending instantly, in the same tick as subscribe, is
// measurably less reliable than sending a few seconds later once things have
// caught up. Observed directly: a real device got its first *real* AQI alert hours
// later without issue, but missed the instant welcome push sent the moment it
// subscribed.
const WELCOME_PUSH_DELAY_MS = 5000;
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sends a one-time confirmation push shortly after a subscription is created --
 * both a friendly "you're all set up" moment and a real end-to-end test of the exact
 * delivery path the AQI alert will later use, rather than the user's first real
 * confirmation being a silent no-op days later when AQI actually crosses a category.
 *
 * Called fire-and-forget (`void sendWelcomeNotification(...)`) from the subscribe
 * route, so this function must never let an error escape as a rejected promise --
 * with nothing awaiting it, an uncaught rejection here would become an unhandled
 * rejection and, with no process-level handler registered, crash the whole server.
 * `sendToSubscription` already contains its own failures; `logDecision` now does
 * too (see above) -- this try/catch is the last line of defense for anything else.
 */
export async function sendWelcomeNotification(sub: SubscriptionRow): Promise<boolean> {
  if (!vapidConfigured) return false;
  try {
    await delay(WELCOME_PUSH_DELAY_MS);
    const title = "You're all set up!";
    const body = "Stormglass will alert you here when air quality is forecast to worsen.";
    const sent = await sendToSubscription(sub, { title, body, tag: 'push-welcome', url: '/' });
    await logDecision(sub.id, 'welcome', sent ? 'sent' : 'delivery_failed', title, body);
    return sent;
  } catch (err) {
    logger.error({ service: 'push', err, subscriptionId: sub.id }, 'Welcome push failed');
    return false;
  }
}

export interface NotificationLogEntry {
  type: NotificationType;
  outcome: NotificationOutcome;
  title: string;
  body: string;
  eventAt: Date | null;
  createdAt: Date;
}

/**
 * Recent alert-worthy decisions for one device, newest first -- what powers the
 * "notification history" view so a suppressed or failed alert leaves a visible
 * trace instead of just looking like nothing happened.
 */
export async function getNotificationLog(subscriptionId: string, limit = 30): Promise<NotificationLogEntry[]> {
  return db
    .select({
      type: pushNotificationLog.type,
      outcome: pushNotificationLog.outcome,
      title: pushNotificationLog.title,
      body: pushNotificationLog.body,
      eventAt: pushNotificationLog.eventAt,
      createdAt: pushNotificationLog.createdAt,
    })
    .from(pushNotificationLog)
    .where(eq(pushNotificationLog.subscriptionId, subscriptionId))
    .orderBy(desc(pushNotificationLog.createdAt))
    .limit(limit) as Promise<NotificationLogEntry[]>;
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
