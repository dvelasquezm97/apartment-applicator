import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:applications');

export async function registerApplicationRoutes(server: FastifyInstance): Promise<void> {
  // TODO: GET /api/applications — list user's applications with status
  // TODO: GET /api/applications/:id — get application details + timeline
  // TODO: GET /api/applications/:id/messages — get messages for application
}
