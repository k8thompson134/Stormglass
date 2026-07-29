import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { getCurrentConfig } from '../jobs/weather-poll.js';
import { env } from '../env.js';
import { isPushConfigured, sendWelcomeNotification } from '../services/push.js';

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface UnsubscribeBody {
  endpoint: string;
}

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/push/vapid-public-key — the frontend fetches this rather than baking
  // it into a build-time env var, so rotating the key doesn't require a rebuild.
  app.get('/api/push/vapid-public-key', async (request, reply) => {
    if (!isPushConfigured()) {
      return reply.status(503).send({ error: 'Push notifications are not configured on this server' });
    }
    return { publicKey: env.VAPID_PUBLIC_KEY };
  });

  // POST /api/push/subscribe — save (or update) a browser's push subscription.
  // Re-subscribing with the same endpoint (e.g. re-enabling the toggle) just
  // upserts rather than erroring, since `endpoint` is the natural unique key.
  app.post<{ Body: SubscribeBody }>('/api/push/subscribe', async (request, reply) => {
    if (!isPushConfigured()) {
      return reply.status(503).send({ error: 'Push notifications are not configured on this server' });
    }

    const { endpoint, keys } = request.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.status(400).send({ error: 'endpoint and keys.{p256dh,auth} are required' });
    }

    const config = getCurrentConfig();
    if (!config) {
      return reply.status(503).send({ error: 'No user configured yet' });
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
        .set({ p256dh: keys.p256dh, auth: keys.auth, aqiAlertsEnabled: true, lastNotifiedCategory: null })
        .where(eq(pushSubscriptions.endpoint, endpoint));
    } else {
      const [inserted] = await db
        .insert(pushSubscriptions)
        .values({ userId: config.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
        .returning({ id: pushSubscriptions.id });
      subscriptionId = inserted.id;
    }

    // Real end-to-end confirmation, not just "the database write succeeded" -- if
    // this fails, setup itself still succeeded (the alert will still fire later),
    // so a failed welcome push is reported but doesn't fail the request.
    const welcomeSent = await sendWelcomeNotification({ id: subscriptionId, endpoint, p256dh: keys.p256dh, auth: keys.auth });

    return reply.status(201).send({ ok: true, welcomeSent });
  });

  // POST /api/push/unsubscribe — remove a subscription (called on toggle-off,
  // before or after the browser's own pushManager.unsubscribe()).
  app.post<{ Body: UnsubscribeBody }>('/api/push/unsubscribe', async (request, reply) => {
    const { endpoint } = request.body ?? {};
    if (!endpoint) {
      return reply.status(400).send({ error: 'endpoint is required' });
    }

    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return { ok: true };
  });
}
