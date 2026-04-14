import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:stats');

export async function registerStatsRoutes(server: FastifyInstance): Promise<void> {
  // TODO: GET /api/stats — dashboard overview stats
  // (active apps, daily count, circuit breaker status, etc.)
}
