import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:listings');

export async function registerListingRoutes(server: FastifyInstance): Promise<void> {
  // TODO: GET /api/listings — list user's discovered listings
  // TODO: GET /api/listings/:id — get listing details
}
