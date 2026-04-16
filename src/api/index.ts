import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.js';
import { registerListingRoutes } from './listings.js';
import { registerApplicationRoutes } from './applications.js';
import { registerDocumentRoutes } from './documents.js';
import { registerSettingsRoutes } from './settings.js';
import { registerStatsRoutes } from './stats.js';
import { registerWebhookRoutes } from './webhooks.js';
import { registerApplyRoutes } from './apply.js';

export async function registerAllRoutes(server: FastifyInstance): Promise<void> {
  await registerHealthRoutes(server);
  await registerListingRoutes(server);
  await registerApplicationRoutes(server);
  await registerDocumentRoutes(server);
  await registerSettingsRoutes(server);
  await registerStatsRoutes(server);
  await registerWebhookRoutes(server);
  await registerApplyRoutes(server);
}
