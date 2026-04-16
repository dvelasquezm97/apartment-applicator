import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { registerAllRoutes } from './api/index.js';
import { registerWebSocketPlugin } from './api/ws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = Fastify({ logger: false });

async function start(): Promise<void> {
  // CORS — allow Vite dev server in development
  await server.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  // File upload support (10MB limit)
  await server.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // WebSocket support (must register before routes and static files)
  await registerWebSocketPlugin(server);

  // Serve built dashboard in production
  if (env.NODE_ENV === 'production') {
    await server.register(fastifyStatic, {
      root: path.join(__dirname, '..', 'web', 'dist'),
      prefix: '/',
      wildcard: true,
      decorateReply: true,
    });
  }

  // Register API routes
  await registerAllRoutes(server);

  // SPA fallback in production: serve index.html for unmatched routes
  if (env.NODE_ENV === 'production') {
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/health') || request.url.startsWith('/webhooks')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  await server.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'API server started');
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start API server');
  process.exit(1);
});
