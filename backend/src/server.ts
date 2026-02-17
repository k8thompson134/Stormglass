import { env } from './env.js';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FastifyInstance } from 'fastify';

import { ensureDefaultUser } from './db/seed.js';
import { weatherRoutes } from './api/weather.js';
import { settingsRoutes } from './api/settings.js';
import { startWeatherPolling, stopPolling } from './jobs/weather-poll.js';
import { client } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: FastifyInstance = Fastify({
  logger: true,
});

// Plugins
await app.register(fastifyCors, {
  origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : true,
  credentials: true,
});

await app.register(fastifyHelmet, { global: true });

await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(fastifyWebsocket);

// Auth: bearer token check on /api/* routes (skipped when API_TOKEN is not set)
if (env.API_TOKEN) {
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;
    // Skip auth for health check, WebSocket upgrade, and static files
    if (!url.startsWith('/api/')) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${env.API_TOKEN}`) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
  app.log.info('API token auth enabled');
}

// Routes
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// WebSocket endpoint
app.get('/ws', { websocket: true }, (connection) => {
  connection.on('message', (data: Buffer) => {
    const message = data.toString();
    app.log.info({ msg: 'Received websocket message', message });
    connection.send(`Server received: ${message}`);
  });

  connection.on('close', () => {
    app.log.info('Client disconnected');
  });
});

// API routes
await app.register(weatherRoutes);
await app.register(settingsRoutes);

app.post('/api/symptoms/logs', async (request, reply) => {
  return reply.status(501).send({ error: 'Not Implemented', message: 'Symptom logging is handled by a separate application.' });
});

// Serve frontend in production
if (env.NODE_ENV === 'production') {
  await app.register(fastifyStatic, {
    root: join(__dirname, '../../frontend/dist'),
  });

  app.get('/*', async (request, reply) => {
    reply.sendFile('index.html');
  });
}

// Start server
const start = async () => {
  try {
    const port = env.PORT;
    const host = env.HOST;

    // Seed default user and start weather polling
    const userId = await ensureDefaultUser();
    startWeatherPolling({ userId, latitude: env.DEFAULT_LATITUDE, longitude: env.DEFAULT_LONGITUDE });

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

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
