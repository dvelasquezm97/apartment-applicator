import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:health');

export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', async (request, reply) => {
    // TODO: Check Redis, Supabase, browser pool, circuit breaker
    // Return 200 if all healthy, 503 with details if not
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        redis: { status: 'ok' },
        supabase: { status: 'ok' },
        browserPool: { status: 'ok', active: 0, idle: 0, max: 2 },
        circuitBreaker: { status: 'ok', openCircuits: 0 },
      },
    };
  });
}
