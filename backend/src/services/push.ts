import webpush from "web-push";
import { desc, eq, lt, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { pushSubscriptions, pushNotificationLog } from "../db/schema.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

type NotificationType =
  | "aqi"
  | "aqi_current"
  | "migraine"
  | "mecfs"
  | "pots"
  | "sinus"
  | "cluster"
  | "fibromyalgia"
  | "clear_air"
  | "welcome";
type NotificationOutcome = "sent" | "suppressed_dedup" | "delivery_failed";

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
  eventAt?: Date,
): Promise<void> {
  try {
    await db.insert(pushNotificationLog).values({
      subscriptionId,
      type,
      outcome,
      title,
      body,
      eventAt: eventAt ?? null,
    });
  } catch (err) {
    logger.error(
      { service: "push", err, subscriptionId },
      "Failed to write notification log entry",
    );
  }
}

const vapidConfigured = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
} else {
  logger.info(
    { service: "push" },
    "VAPID keys not configured -- push notifications disabled",
  );
}

export function isPushConfigured(): boolean {
  return vapidConfigured;
}

export interface AqiAlertPayload {
  toCategory: string;
  usAqi: number;
  at: string;
  clearAt: string | null;
}

export interface CurrentAqiBadPayload {
  category: string;
  usAqi: number;
  clearAt: string | null;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Category names read fine as headline nouns ("Unhealthy for Sensitive Groups") but
// Title Case reads as shouting mid-sentence ("...for Sensitive Groups levels from
// 4-9pm") -- none of EPA's category names contain proper nouns, so a full lowercase
// is safe and reads as ordinary prose once embedded in a sentence.
function lowerCategory(s: string): string {
  return s.toLowerCase();
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * Builds the "from X to Y" / "starting X" clause shared by both AQI alert types --
 * says a real window when the forecast shows the AQI dropping back down within the
 * data already fetched, and falls back to an open-ended "at least into tomorrow's
 * forecast" when it doesn't, rather than a start-only alert with no sense of how
 * long the bad air is expected to last.
 */
function formatAqiWindow(start: Date, clearAt: string | null): string {
  const startTime = formatTime(start);
  if (!clearAt) {
    return `starting ${startTime}, continuing at least into tomorrow's forecast`;
  }
  const end = new Date(clearAt);
  const endTime = formatTime(end);
  if (isSameLocalDay(start, end)) {
    return `from ${startTime} to ${endTime}`;
  }
  return `from ${startTime} until ~${endTime} tomorrow`;
}

// Short, category-specific action rather than a generic "close your windows" for
// every severity -- what you'd actually do differs a lot between USG and Hazardous.
// Kept word-for-word identical (modulo the capitalization/punctuation each call site
// needs) to frontend/src/utils/aqiCategory.ts's CATEGORY_GUIDANCE -- verified in sync
// by backend/src/services/push.test.ts, which fails if the two ever say different
// things.
const CATEGORY_GUIDANCE: Record<string, string> = {
  "Unhealthy for Sensitive Groups":
    "if you're sensitive to air quality, limit prolonged outdoor exertion",
  Unhealthy: "limit prolonged outdoor exertion",
  "Very Unhealthy": "avoid outdoor exertion",
  Hazardous: "stay indoors and avoid outdoor exertion entirely",
};

// Ordinal so we can tell "risk went up" from "risk went down" -- unlike AQI category
// crossings (which only fire on worsening), the condition-specific risk alerts below
// (migraine, ME/CFS, POTS) have no natural forward-looking crossing helper, so dedup
// has to compare levels directly rather than a plain equality check -- otherwise a
// device notified at "high" would get re-notified every poll cycle risk stays high,
// and dropping to "moderate" then climbing back to "high" wouldn't re-fire at all.
const RISK_ORDER: Record<string, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

// Shared by every risk-level alert type (migraine, ME/CFS, POTS) -- only fires again
// once risk has gotten WORSE than what this device was last notified about.
function riskIsDuplicate(lastNotified: string | null, key: string): boolean {
  const lastOrder = lastNotified ? (RISK_ORDER[lastNotified] ?? -1) : -1;
  return RISK_ORDER[key] <= lastOrder;
}

export interface MigraineRiskPayload {
  riskLevel: "high" | "severe";
  delta1h: number;
}

export interface MecfsRiskPayload {
  riskLevel: "high" | "severe";
  volatility: number;
}

export interface PotsRiskPayload {
  riskLevel: "high" | "severe";
  primaryStressor: "heat" | "cold" | "pressure";
  tempF: number;
}

export interface SinusRiskPayload {
  riskLevel: "high" | "severe";
  pollenMax: number;
  // Which of getSinusRisk's inputs actually crossed its own threshold -- the
  // body only names factors that are actually true, rather than asserting a
  // fixed "pressure and humidity" story that may not match what drove the
  // score (e.g. pollen or AQI alone can push this to high/severe).
  pressureElevated: boolean;
  humidityElevated: boolean;
  aqiElevated: boolean;
}

export interface ClusterHeadacheRiskPayload {
  riskLevel: "high" | "severe";
  // The dominant pressure signal -- whichever of delta1h/delta3h/delta6h
  // actually crossed getClusterHeadacheRisk's threshold for that window, since
  // a 3h/6h-driven score can have delta1h flat or even positive (pressure
  // recovering after a bottomed-out drop), which would make an always-delta1h
  // body wrong about what's actually happening right now.
  dominantWindow: "1h" | "3h" | "6h";
  dominantValue: number;
  uvHigh: boolean;
}

export interface FibromyalgiaRiskPayload {
  riskLevel: "high" | "severe";
  // Same reasoning as SinusRiskPayload above -- getFibromyalgiaRisk can reach
  // high/severe purely from heat+humidity with pressure flat, so the body must
  // not unconditionally claim "cold, damp, and pressure changes."
  isCold: boolean;
  isDamp: boolean;
  isHot: boolean;
  pressureElevated: boolean;
}

export interface ClearAirWindowPayload {
  startAt: string;
  endAt: string;
  durationHours: number;
  avgAqi: number;
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
async function sendToSubscription(
  sub: SubscriptionRow,
  payload: NotificationPayload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      logger.info(
        { service: "push", subscriptionId: sub.id },
        "Subscription gone -- removing",
      );
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id));
    } else {
      logger.error(
        { service: "push", err, subscriptionId: sub.id },
        "Failed to send push notification",
      );
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
  buildDedupUpdate: (
    dedupKey: string,
  ) => Partial<typeof pushSubscriptions.$inferInsert>;
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

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(config.subsWhere);

  await Promise.all(
    subs.map(async (sub) => {
      const lastNotified = config.getLastNotified(sub);
      if (config.isDuplicate(lastNotified, config.dedupKey)) {
        await logDecision(
          sub.id,
          config.type,
          "suppressed_dedup",
          config.title,
          config.body,
          config.eventAt,
        );
        return;
      }

      const sent = await sendToSubscription(sub, {
        title: config.title,
        body: config.body,
        tag: config.tag,
        url: "/",
      });
      await logDecision(
        sub.id,
        config.type,
        sent ? "sent" : "delivery_failed",
        config.title,
        config.body,
        config.eventAt,
      );
      if (sent) {
        await db
          .update(pushSubscriptions)
          .set(config.buildDedupUpdate(config.dedupKey))
          .where(eq(pushSubscriptions.id, sub.id));
      }
    }),
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
export async function sendAqiCrossingAlert(
  payload: AqiAlertPayload,
): Promise<void> {
  const guidance = CATEGORY_GUIDANCE[payload.toCategory];
  const window = formatAqiWindow(new Date(payload.at), payload.clearAt);
  const body = `${lowerCategory(payload.toCategory)} levels ${window} (AQI up to ${payload.usAqi})${guidance ? ` -- ${guidance}` : ""}`;
  const dedupKey = `${payload.toCategory}::${payload.at.slice(0, 10)}`;

  await dispatchAlert({
    type: "aqi",
    subsWhere: eq(pushSubscriptions.aqiAlertsEnabled, true),
    title: "Air quality worsening soon",
    body,
    tag: "aqi-category-crossing",
    eventAt: new Date(payload.at),
    dedupKey,
    getLastNotified: (sub) => sub.lastNotifiedCategory,
    isDuplicate: (last, key) => last === key,
    buildDedupUpdate: (key) => ({ lastNotifiedCategory: key }),
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
export async function sendCurrentAqiBadAlert(
  payload: CurrentAqiBadPayload,
): Promise<void> {
  const guidance = CATEGORY_GUIDANCE[payload.category];
  // "Expected to ease by ~X" when the same-cycle forecast scan found a clear time;
  // otherwise say nothing about duration rather than guess -- an unqualified "right
  // now" reading is still accurate, just silent on how long it lasts.
  const clearClause = payload.clearAt
    ? ` -- expected to ease by ~${formatTime(new Date(payload.clearAt))}`
    : "";
  const body = `AQI ${payload.usAqi} right now (${lowerCategory(payload.category)})${clearClause}${guidance ? `. ${guidance.charAt(0).toUpperCase()}${guidance.slice(1)}.` : ""}`;

  await dispatchAlert({
    type: "aqi_current",
    subsWhere: eq(pushSubscriptions.aqiAlertsEnabled, true),
    title: "Air quality is bad right now",
    body,
    tag: "aqi-current-bad",
    dedupKey: payload.category,
    getLastNotified: (sub) => sub.lastNotifiedCurrentBadCategory,
    isDuplicate: (last, key) => last === key,
    buildDedupUpdate: (key) => ({ lastNotifiedCurrentBadCategory: key }),
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
export async function sendMigraineRiskAlert(
  payload: MigraineRiskPayload,
): Promise<void> {
  // Direction-aware -- both a fast drop and a fast rise are migraine triggers (see
  // getMigraineRisk's Math.abs(delta)), so a fixed "dropping" would be wrong half
  // the time. Matches the "falling"/"rising" wording healthLogic.ts already uses for
  // this same signal elsewhere in the app.
  const direction = payload.delta1h < 0 ? "dropping" : "rising";
  const rate = Math.abs(payload.delta1h).toFixed(1);
  const title =
    payload.riskLevel === "severe"
      ? "Migraine risk is severe right now"
      : "Migraine risk is high right now";
  const body =
    payload.riskLevel === "severe"
      ? `Pressure is ${direction} fast (${rate} hPa/hr) -- consider using rescue treatment early`
      : `Pressure is ${direction} fast (${rate} hPa/hr) -- this pattern often triggers migraines, consider preventive care now`;

  await dispatchAlert({
    type: "migraine",
    subsWhere: eq(pushSubscriptions.migraineAlertsEnabled, true),
    title,
    body,
    tag: "migraine-risk",
    dedupKey: payload.riskLevel,
    getLastNotified: (sub) => sub.lastNotifiedMigraineRisk,
    isDuplicate: riskIsDuplicate,
    buildDedupUpdate: (key) => ({ lastNotifiedMigraineRisk: key }),
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

/**
 * Sends an ME/CFS crash-risk alert -- pressure volatility (not direction) is the
 * trigger here (see getMECFSRisk), so unlike migraine there's no rising/dropping
 * framing, just "conditions have been swinging a lot," which is what actually
 * precedes a PEM crash.
 */
export async function sendMecfsRiskAlert(
  payload: MecfsRiskPayload,
): Promise<void> {
  const volatility = payload.volatility.toFixed(1);
  const title =
    payload.riskLevel === "severe"
      ? "ME/CFS crash risk is severe right now"
      : "ME/CFS crash risk is high right now";
  const body =
    payload.riskLevel === "severe"
      ? `Pressure has been swinging a lot over the last 6 hours (volatility ${volatility}) -- strong crash-risk pattern, scale back today's activity and rest proactively`
      : `Pressure has been unusually volatile over the last 6 hours (volatility ${volatility}) -- this pattern often precedes a PEM crash, consider pacing back today`;

  await dispatchAlert({
    type: "mecfs",
    subsWhere: eq(pushSubscriptions.mecfsAlertsEnabled, true),
    title,
    body,
    tag: "mecfs-risk",
    dedupKey: payload.riskLevel,
    getLastNotified: (sub) => sub.lastNotifiedMecfsRisk,
    isDuplicate: riskIsDuplicate,
    buildDedupUpdate: (key) => ({ lastNotifiedMecfsRisk: key }),
  });
}

/**
 * Clears ME/CFS crash-risk dedup state once volatility drops back to moderate/low --
 * same reasoning as clearMigraineRiskDedupState above.
 */
export async function clearMecfsRiskDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedMecfsRisk: null })
    .where(eq(pushSubscriptions.mecfsAlertsEnabled, true));
}

/**
 * Sends a POTS/dysautonomia risk alert -- framed around whichever stressor is
 * actually driving the score (heat, cold, or pressure swings; see getPOTSRisk's
 * primaryStressor logic) rather than a generic "conditions are bad," since the
 * practical response (cooling down vs. warming up) differs by which one it is.
 */
export async function sendPotsRiskAlert(
  payload: PotsRiskPayload,
): Promise<void> {
  const stressorClause =
    payload.primaryStressor === "heat"
      ? `it's hot (${payload.tempF}°F) and conditions are stacking`
      : payload.primaryStressor === "cold"
        ? `it's cold (${payload.tempF}°F) and conditions are stacking`
        : "pressure is swinging fast alongside other stressors";
  const careClause =
    payload.primaryStressor === "heat"
      ? "stay cool and pace standing/upright time"
      : payload.primaryStressor === "cold"
        ? "stay warm and pace standing/upright time"
        : "pace standing/upright time";

  const title =
    payload.riskLevel === "severe"
      ? "POTS risk is severe right now"
      : "POTS risk is high right now";
  const body =
    payload.riskLevel === "severe"
      ? `Today's ${stressorClause} -- expect more dizziness/tachycardia, ${careClause} and keep fluids/electrolytes on hand`
      : `Today's ${stressorClause} -- ${careClause}`;

  await dispatchAlert({
    type: "pots",
    subsWhere: eq(pushSubscriptions.potsAlertsEnabled, true),
    title,
    body,
    tag: "pots-risk",
    dedupKey: payload.riskLevel,
    getLastNotified: (sub) => sub.lastNotifiedPotsRisk,
    isDuplicate: riskIsDuplicate,
    buildDedupUpdate: (key) => ({ lastNotifiedPotsRisk: key }),
  });
}

/**
 * Clears POTS-risk dedup state once conditions ease back to moderate/low -- same
 * reasoning as clearMigraineRiskDedupState above.
 */
export async function clearPotsRiskDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedPotsRisk: null })
    .where(eq(pushSubscriptions.potsAlertsEnabled, true));
}

/**
 * Sends a sinus-risk alert -- lists only the factors that actually crossed
 * getSinusRisk's thresholds (pressure/humidity/pollen/AQI can each independently
 * push this to high/severe), rather than asserting a fixed "pressure and
 * humidity" story that may not be what's actually happening.
 */
export async function sendSinusRiskAlert(
  payload: SinusRiskPayload,
): Promise<void> {
  const factors: string[] = [];
  if (payload.pressureElevated) factors.push("pressure is changing fast");
  if (payload.humidityElevated) factors.push("humidity is elevated");
  if (payload.pollenMax >= 3)
    factors.push(`pollen is elevated (index ${payload.pollenMax})`);
  if (payload.aqiElevated) factors.push("air quality is poor");
  // All four inputs can independently drive a high/severe score, so at least
  // one of the flags above should be set whenever this is called -- this
  // fallback only exists as a defensive net against a future scoring change.
  const factorClause =
    factors.length > 0 ? factors.join(" and ") : "conditions are elevated";

  const title =
    payload.riskLevel === "severe"
      ? "Sinus risk is severe right now"
      : "Sinus risk is high right now";
  const body =
    payload.riskLevel === "severe"
      ? `${factorClause[0].toUpperCase()}${factorClause.slice(1)} -- expect significant congestion or pain, use a saline rinse now`
      : `${factorClause[0].toUpperCase()}${factorClause.slice(1)} -- consider a saline rinse or antihistamine`;

  await dispatchAlert({
    type: "sinus",
    subsWhere: eq(pushSubscriptions.sinusAlertsEnabled, true),
    title,
    body,
    tag: "sinus-risk",
    dedupKey: payload.riskLevel,
    getLastNotified: (sub) => sub.lastNotifiedSinusRisk,
    isDuplicate: riskIsDuplicate,
    buildDedupUpdate: (key) => ({ lastNotifiedSinusRisk: key }),
  });
}

/**
 * Clears sinus-risk dedup state once conditions ease back to moderate/low -- same
 * reasoning as clearMigraineRiskDedupState above.
 */
export async function clearSinusRiskDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedSinusRisk: null })
    .where(eq(pushSubscriptions.sinusAlertsEnabled, true));
}

/**
 * Sends a cluster-headache alert -- unlike migraine, only fires on pressure DROPS
 * (never rises) and bright light. Reports whichever of delta1h/delta3h/delta6h
 * actually crossed getClusterHeadacheRisk's threshold (a 3h/6h-driven score can
 * have delta1h flat or even positive, e.g. pressure recovering after a
 * bottomed-out drop, so always quoting delta1h would misdescribe what's
 * happening right now).
 */
export async function sendClusterHeadacheRiskAlert(
  payload: ClusterHeadacheRiskPayload,
): Promise<void> {
  const magnitude = Math.abs(payload.dominantValue).toFixed(1);
  const pressureClause =
    payload.dominantWindow === "1h"
      ? `Pressure is dropping fast right now (${magnitude} hPa/hr)`
      : `Pressure has dropped ${magnitude} hPa over the last ${payload.dominantWindow}`;
  const uvClause = payload.uvHigh ? " and UV is high today" : "";

  const title =
    payload.riskLevel === "severe"
      ? "Cluster headache risk is severe right now"
      : "Cluster headache risk is high right now";
  const body =
    payload.riskLevel === "severe"
      ? `${pressureClause}${uvClause} -- high-risk period, keep any prescribed oxygen/triptans within reach`
      : `${pressureClause}${uvClause} -- monitor for early cluster warning signs`;

  await dispatchAlert({
    type: "cluster",
    subsWhere: eq(pushSubscriptions.clusterAlertsEnabled, true),
    title,
    body,
    tag: "cluster-risk",
    dedupKey: payload.riskLevel,
    getLastNotified: (sub) => sub.lastNotifiedClusterRisk,
    isDuplicate: riskIsDuplicate,
    buildDedupUpdate: (key) => ({ lastNotifiedClusterRisk: key }),
  });
}

/**
 * Clears cluster-headache dedup state once pressure stabilizes -- same reasoning
 * as clearMigraineRiskDedupState above.
 */
export async function clearClusterHeadacheRiskDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedClusterRisk: null })
    .where(eq(pushSubscriptions.clusterAlertsEnabled, true));
}

/**
 * Sends a fibromyalgia flare-risk alert -- lists only the factors that actually
 * crossed getFibromyalgiaRisk's thresholds. Cold+damp is the classic trigger, but
 * heat+humidity alone (isHot, with pressure flat) can also reach high/severe, so
 * an unconditional "cold, damp, and pressure changes" body would misdescribe a
 * hot-weather flare.
 */
export async function sendFibromyalgiaRiskAlert(
  payload: FibromyalgiaRiskPayload,
): Promise<void> {
  const factors: string[] = [];
  if (payload.isCold) factors.push("it's cold");
  if (payload.isHot) factors.push("it's hot");
  if (payload.isDamp) factors.push("humidity is elevated");
  if (payload.pressureElevated) factors.push("pressure is changing");
  const factorClause =
    factors.length > 0 ? factors.join(" and ") : "conditions are elevated";

  const title =
    payload.riskLevel === "severe"
      ? "Fibromyalgia flare risk is severe right now"
      : "Fibromyalgia flare risk is high right now";
  const body =
    payload.riskLevel === "severe"
      ? `${factorClause[0].toUpperCase()}${factorClause.slice(1)} -- one of the most reliable pain amplifiers, pace activity carefully and keep heat packs on hand`
      : `${factorClause[0].toUpperCase()}${factorClause.slice(1)} -- consider pacing back today`;

  await dispatchAlert({
    type: "fibromyalgia",
    subsWhere: eq(pushSubscriptions.fibromyalgiaAlertsEnabled, true),
    title,
    body,
    tag: "fibromyalgia-risk",
    dedupKey: payload.riskLevel,
    getLastNotified: (sub) => sub.lastNotifiedFibromyalgiaRisk,
    isDuplicate: riskIsDuplicate,
    buildDedupUpdate: (key) => ({ lastNotifiedFibromyalgiaRisk: key }),
  });
}

/**
 * Clears fibromyalgia-risk dedup state once conditions ease back to moderate/low --
 * same reasoning as clearMigraineRiskDedupState above.
 */
export async function clearFibromyalgiaRiskDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedFibromyalgiaRisk: null })
    .where(eq(pushSubscriptions.fibromyalgiaAlertsEnabled, true));
}

/**
 * Sends a "clean air window coming up" alert -- the positive inverse of the AQI
 * bad-right-now alert, for planning outdoor time rather than reacting to bad air.
 * Dedup key is the window's start time truncated to the hour (not a risk level --
 * there's no ordinal "worse than last time" here, just "have we already told this
 * device about this specific window").
 */
export async function sendClearAirAlert(
  payload: ClearAirWindowPayload,
): Promise<void> {
  const start = new Date(payload.startAt);
  const end = new Date(payload.endAt);
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  const window = isSameLocalDay(start, end)
    ? `from ${startTime} to ${endTime}`
    : `from ${startTime} until ~${endTime} tomorrow`;
  const body = `Air quality looks good ${window} (~${payload.durationHours}h, avg AQI ${payload.avgAqi}) -- good window to be outside`;
  const dedupKey = payload.startAt.slice(0, 13); // truncate to the hour

  await dispatchAlert({
    type: "clear_air",
    subsWhere: eq(pushSubscriptions.clearAirAlertsEnabled, true),
    title: "Clean air window coming up",
    body,
    tag: "clear-air-window",
    eventAt: start,
    dedupKey,
    getLastNotified: (sub) => sub.lastNotifiedClearAirWindowStart,
    isDuplicate: (last, key) => last === key,
    buildDedupUpdate: (key) => ({ lastNotifiedClearAirWindowStart: key }),
  });
}

/**
 * Clears clean-air-window dedup state once no upcoming window is found within the
 * alert lookahead, so a later window (even one that resolves to the same truncated
 * start hour some other day) isn't silently skipped as "already notified."
 */
export async function resetClearAirDedupState(): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedClearAirWindowStart: null })
    .where(eq(pushSubscriptions.clearAirAlertsEnabled, true));
}

// A push subscription needs a moment to fully settle with the push service (FCM)
// right after creation -- sending instantly, in the same tick as subscribe, is
// measurably less reliable than sending a few seconds later once things have
// caught up. Observed directly: a real device got its first *real* AQI alert hours
// later without issue, but missed the instant welcome push sent the moment it
// subscribed.
const WELCOME_PUSH_DELAY_MS = 5000;
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
export async function sendWelcomeNotification(
  sub: SubscriptionRow,
): Promise<boolean> {
  if (!vapidConfigured) return false;
  try {
    await delay(WELCOME_PUSH_DELAY_MS);
    const title = "You're all set up!";
    const body =
      "Stormglass will alert you here when air quality is forecast to worsen.";
    const sent = await sendToSubscription(sub, {
      title,
      body,
      tag: "push-welcome",
      url: "/",
    });
    await logDecision(
      sub.id,
      "welcome",
      sent ? "sent" : "delivery_failed",
      title,
      body,
    );
    return sent;
  } catch (err) {
    logger.error(
      { service: "push", err, subscriptionId: sub.id },
      "Welcome push failed",
    );
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
export async function getNotificationLog(
  subscriptionId: string,
  limit = 30,
): Promise<NotificationLogEntry[]> {
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

// One row per alert-worthy decision, including every suppressed-by-dedup cycle --
// a single sustained condition logs roughly one row per subscription per alert type
// per 30-min poll (~48/device/day), more with several conditions active at once, and
// nothing previously deleted old rows. getNotificationLog only ever reads the most
// recent 30 anyway, so this keeps well past that while bounding unbounded growth.
const NOTIFICATION_LOG_RETENTION_DAYS = 30;

export async function pruneNotificationLog(): Promise<number> {
  const cutoff = new Date(
    Date.now() - NOTIFICATION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const deleted = await db
    .delete(pushNotificationLog)
    .where(lt(pushNotificationLog.createdAt, cutoff))
    .returning({ id: pushNotificationLog.id });
  return deleted.length;
}
