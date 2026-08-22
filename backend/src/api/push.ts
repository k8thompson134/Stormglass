import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { pushSubscriptions } from "../db/schema.js";
import { getCurrentConfig } from "../jobs/weather-poll.js";
import { env } from "../env.js";
import {
  isPushConfigured,
  sendWelcomeNotification,
  getNotificationLog,
} from "../services/push.js";

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface UnsubscribeBody {
  endpoint: string;
}

interface AlertToggleBody {
  endpoint: string;
  enabled: boolean;
}

type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/**
 * Registers a GET (read opt-in state) + POST (toggle it) pair for one
 * secondary/condition-specific alert type -- migraine, ME/CFS, POTS, and clean-air
 * all follow this exact shape (separate opt-in from the main AQI toggle, cleared
 * dedup state on enable so a currently-elevated condition can alert right away
 * rather than waiting for the next level change). These four used to be
 * hand-copied route pairs; a fix to the shape now only needs to happen once here.
 */
function registerAlertToggleRoutes(
  app: FastifyInstance,
  path: string,
  readEnabled: (sub: PushSubscriptionRow) => boolean,
  buildUpdate: (
    enabled: boolean,
  ) => Partial<typeof pushSubscriptions.$inferInsert>,
): void {
  app.get<{ Querystring: { endpoint: string } }>(
    `/api/push/${path}`,
    async (request, reply) => {
      const { endpoint } = request.query ?? {};
      if (!endpoint) {
        return reply.status(400).send({ error: "endpoint is required" });
      }

      const [row] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .limit(1);
      return { enabled: row ? readEnabled(row) : false };
    },
  );

  app.post<{ Body: AlertToggleBody }>(
    `/api/push/${path}`,
    async (request, reply) => {
      const { endpoint, enabled } = request.body ?? {};
      if (!endpoint || typeof enabled !== "boolean") {
        return reply
          .status(400)
          .send({ error: "endpoint and enabled are required" });
      }

      const result = await db
        .update(pushSubscriptions)
        .set(buildUpdate(enabled))
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .returning({ id: pushSubscriptions.id });

      if (result.length === 0) {
        return reply.status(404).send({ error: "Subscription not found" });
      }

      return { ok: true };
    },
  );
}

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/push/vapid-public-key — the frontend fetches this rather than baking
  // it into a build-time env var, so rotating the key doesn't require a rebuild.
  app.get("/api/push/vapid-public-key", async (request, reply) => {
    if (!isPushConfigured()) {
      return reply
        .status(503)
        .send({
          error: "Push notifications are not configured on this server",
        });
    }
    return { publicKey: env.VAPID_PUBLIC_KEY };
  });

  // POST /api/push/subscribe — save (or update) a browser's push subscription.
  // Re-subscribing with the same endpoint (e.g. re-enabling the toggle) just
  // upserts rather than erroring, since `endpoint` is the natural unique key.
  app.post<{ Body: SubscribeBody }>(
    "/api/push/subscribe",
    async (request, reply) => {
      if (!isPushConfigured()) {
        return reply
          .status(503)
          .send({
            error: "Push notifications are not configured on this server",
          });
      }

      const { endpoint, keys } = request.body ?? {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply
          .status(400)
          .send({ error: "endpoint and keys.{p256dh,auth} are required" });
      }

      const config = getCurrentConfig();
      if (!config) {
        return reply.status(503).send({ error: "No user configured yet" });
      }

      const existing = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .limit(1);

      let subscriptionId: string;
      if (existing.length > 0) {
        subscriptionId = existing[0].id;
        await db
          .update(pushSubscriptions)
          .set({
            p256dh: keys.p256dh,
            auth: keys.auth,
            aqiAlertsEnabled: true,
            lastNotifiedCategory: null,
          })
          .where(eq(pushSubscriptions.endpoint, endpoint));
      } else {
        const [inserted] = await db
          .insert(pushSubscriptions)
          .values({
            userId: config.userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          })
          .returning({ id: pushSubscriptions.id });
        subscriptionId = inserted.id;
      }

      // Deliberately NOT awaited -- sendWelcomeNotification has a built-in delay
      // (subscriptions need a moment to settle with the push service), and blocking
      // this response on that would make the Settings toggle look stuck for seconds.
      // sendWelcomeNotification catches its own errors and never rejects; the .catch
      // here is a second line of defense so a fire-and-forget call can never become
      // an unhandled rejection (which would crash the whole process) even if that
      // internal guarantee is ever weakened by a future edit.
      void sendWelcomeNotification({
        id: subscriptionId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }).catch((err) =>
        request.log.error({ err }, "Unexpected error sending welcome push"),
      );

      return reply.status(201).send({ ok: true });
    },
  );

  // POST /api/push/unsubscribe — remove a subscription (called on toggle-off,
  // before or after the browser's own pushManager.unsubscribe()).
  app.post<{ Body: UnsubscribeBody }>(
    "/api/push/unsubscribe",
    async (request, reply) => {
      const { endpoint } = request.body ?? {};
      if (!endpoint) {
        return reply.status(400).send({ error: "endpoint is required" });
      }

      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint));
      return { ok: true };
    },
  );

  // /api/push/migraine-alerts, /api/push/mecfs-alerts, /api/push/pots-alerts,
  // /api/push/clear-air-alerts — each a distinct opt-in from the main AQI toggle
  // and from each other, since these condition-specific alerts oscillate on their
  // own schedules and bundling them would surprise someone who only wanted one.
  registerAlertToggleRoutes(
    app,
    "migraine-alerts",
    (sub) => sub.migraineAlertsEnabled,
    (enabled) => ({
      migraineAlertsEnabled: enabled,
      lastNotifiedMigraineRisk: null,
    }),
  );
  registerAlertToggleRoutes(
    app,
    "mecfs-alerts",
    (sub) => sub.mecfsAlertsEnabled,
    (enabled) => ({ mecfsAlertsEnabled: enabled, lastNotifiedMecfsRisk: null }),
  );
  registerAlertToggleRoutes(
    app,
    "pots-alerts",
    (sub) => sub.potsAlertsEnabled,
    (enabled) => ({ potsAlertsEnabled: enabled, lastNotifiedPotsRisk: null }),
  );
  registerAlertToggleRoutes(
    app,
    "clear-air-alerts",
    (sub) => sub.clearAirAlertsEnabled,
    (enabled) => ({
      clearAirAlertsEnabled: enabled,
      lastNotifiedClearAirWindowStart: null,
    }),
  );

  // GET /api/push/notification-log — recent alert-worthy decisions for this device
  // (sent, suppressed by dedup, or failed delivery), newest first.
  app.get<{ Querystring: { endpoint: string } }>(
    "/api/push/notification-log",
    async (request, reply) => {
      const { endpoint } = request.query ?? {};
      if (!endpoint) {
        return reply.status(400).send({ error: "endpoint is required" });
      }

      const [sub] = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .limit(1);

      if (!sub) {
        return reply.status(404).send({ error: "Subscription not found" });
      }

      const entries = await getNotificationLog(sub.id);
      return { entries };
    },
  );
}
