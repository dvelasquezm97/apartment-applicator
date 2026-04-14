import Fastify from 'fastify';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { registerAllRoutes } from './api/index.js';

const server = Fastify({ logger: false });

async function start(): Promise<void> {
  // Register routes
  await registerAllRoutes(server);

  // TODO: Register Fastify plugins (cors, helmet, jwt, multipart, static, rate-limit)
  // TODO: Serve built dashboard from web/dist/ in production
  // TODO: Start Telegram bot (webhook mode in production)

  await server.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'API server started');
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start API server');
  process.exit(1);
});
