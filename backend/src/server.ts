import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FastifyInstance } from 'fastify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: FastifyInstance = Fastify({
  logger: true,
});

// Plugins
await app.register(fastifyCors, {
  origin: true,
  credentials: true,
});

await app.register(fastifyWebsocket);

// Routes
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// WebSocket endpoint
app.get('/ws', { websocket: true }, (connection, req) => {
  connection.socket.on('message', (data) => {
    const message = data.toString();
    console.log('Received:', message);

    // Echo back
    connection.socket.send(`Server received: ${message}`);
  });

  connection.socket.on('close', () => {
    console.log('Client disconnected');
  });
});

// API routes (placeholder)
app.get('/api/weather/current', async (request, reply) => {
  return { message: 'Current weather endpoint' };
});

app.post('/api/symptoms/logs', async (request, reply) => {
  return { message: 'Create symptom log endpoint' };
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
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
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

export default app;
