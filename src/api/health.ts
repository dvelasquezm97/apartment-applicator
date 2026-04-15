import type { FastifyInstance } from 'fastify';
import { createRedisConnection } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';

export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', async (request, reply) => {
    const checks: Record<string, { status: string; error?: string }> = {};

    // Redis check
    try {
      const redis = createRedisConnection();
      await redis.ping();
      await redis.quit();
      checks.redis = { status: 'ok' };
    } catch (err) {
      checks.redis = { status: 'error', error: (err as Error).message };
    }

    // Supabase check
    try {
      const { error } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true });
      checks.supabase = error ? { status: 'error', error: error.message } : { status: 'ok' };
    } catch (err) {
      checks.supabase = { status: 'error', error: (err as Error).message };
    }

    const allOk = Object.values(checks).every(c => c.status === 'ok');

    reply.code(allOk ? 200 : 503).send({
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
