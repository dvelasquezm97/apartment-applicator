import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:webhooks');

export async function registerWebhookRoutes(server: FastifyInstance): Promise<void> {
  // TODO: POST /webhooks/telegram — Telegram bot webhook endpoint
}
