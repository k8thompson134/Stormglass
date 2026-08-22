import { env } from "./env.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { FastifyInstance } from "fastify";

import { ensureDefaultUser } from "./db/seed.js";
import { weatherRoutes } from "./api/weather.js";
import { settingsRoutes } from "./api/settings.js";
import { symptomRoutes } from "./api/symptoms.js";
import { briefingRoutes } from "./api/briefing.js";
import { pushRoutes } from "./api/push.js";
import { startWeatherPolling, stopPolling } from "./jobs/weather-poll.js";
import { client } from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: FastifyInstance = Fastify({
  logger: true,
});

// Plugins
await app.register(fastifyCors, {
  origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",") : true,
  credentials: true,
});

await app.register(fastifyHelmet, { global: true });

await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Auth: bearer token check on /api/* routes (skipped when API_TOKEN is not set)
if (env.API_TOKEN) {
  app.addHook("onRequest", async (request, reply) => {
    const url = request.url;
    // Skip auth for health check and static files
    if (!url.startsWith("/api/")) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${env.API_TOKEN}`) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
  app.log.info("API token auth enabled");
}

// Routes
app.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Stricter rate limit for geocoding (proxy to third-party API)
const geocodeLimit = new Map<string, { count: number; resetAt: number }>();
const GEOCODE_MAX = 20;
const GEOCODE_WINDOW_MS = 60_000;
app.addHook("onRequest", async (request, reply) => {
  if (request.url?.startsWith("/api/geocode") !== true) return;
  const ip = request.ip;
  const now = Date.now();
  let entry = geocodeLimit.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + GEOCODE_WINDOW_MS };
    geocodeLimit.set(ip, entry);
  }
  entry.count++;
  if (entry.count > GEOCODE_MAX) {
    return reply
      .status(429)
      .send({ error: "Too many geocode requests", retryAfter: 60 });
  }
});

// API routes
await app.register(weatherRoutes);
await app.register(settingsRoutes);
await app.register(symptomRoutes);
await app.register(briefingRoutes);
await app.register(pushRoutes);

// Serve frontend in production
if (env.NODE_ENV === "production") {
  await app.register(fastifyStatic, {
    root: join(__dirname, "../../frontend/dist"),
    wildcard: false,
  });

  app.get("/*", async (request, reply) => {
    reply.sendFile("index.html");
  });
}

// Start server
const start = async () => {
  try {
    const port = env.PORT;
    const host = env.HOST;

    // Seed default user and start weather polling at whatever location was last
    // saved (falls back to the DEFAULT_LATITUDE/LONGITUDE env vars only for a
    // brand-new user, see db/seed.ts) -- using those defaults unconditionally here
    // would silently discard the user's saved location on every restart.
    const defaultUser = await ensureDefaultUser();
    startWeatherPolling({
      userId: defaultUser.id,
      latitude: defaultUser.latitude,
      longitude: defaultUser.longitude,
      name: defaultUser.name ?? undefined,
    });

    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully`);
  stopPolling();
  await app.close();
  await client.end();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
