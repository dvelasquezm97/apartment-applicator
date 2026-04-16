import type { FastifyInstance } from 'fastify';
import { ApplyLoop } from '../orchestrator/apply-loop.js';
import { isExtensionConnected } from './ws.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:apply');

// Active apply loops per user
const activeLoops = new Map<string, ApplyLoop>();

/** Get the current progress for a user's apply loop (used by ws.ts for initial dashboard state). */
export function getApplyLoopStatus(userId: string): {
  status: string;
  applied: number;
  failed: number;
  skipped: number;
  total: number;
  currentListing: string | null;
} | null {
  const loop = activeLoops.get(userId);
  if (!loop) return null;
  return loop.getStatus();
}

export async function registerApplyRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/apply/start — start the apply loop
  server.post('/api/apply/start', async (request, reply) => {
    const userId = getUserId(request);

    if (activeLoops.has(userId)) {
      return reply.code(409).send({ error: 'Apply loop already running' });
    }

    if (!isExtensionConnected(userId)) {
      return reply.code(400).send({ error: 'Chrome extension not connected' });
    }

    const loop = new ApplyLoop(userId);
    activeLoops.set(userId, loop);

    // Start in background — don't await
    loop.start()
      .catch(err => log.error({ userId, error: (err as Error).message }, 'Apply loop error'))
      .finally(() => activeLoops.delete(userId));

    return { success: true, message: 'Apply loop started' };
  });

  // POST /api/apply/stop — stop the apply loop
  server.post('/api/apply/stop', async (request, reply) => {
    const userId = getUserId(request);
    const loop = activeLoops.get(userId);

    if (!loop) {
      return reply.code(404).send({ error: 'No active apply loop' });
    }

    loop.stop();
    activeLoops.delete(userId);
    return { success: true, message: 'Apply loop stopped' };
  });

  // GET /api/apply/status — get current apply status
  server.get('/api/apply/status', async (request, reply) => {
    const userId = getUserId(request);
    const loop = activeLoops.get(userId);

    if (!loop) {
      return {
        status: 'idle',
        applied: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        currentListing: null,
        extensionConnected: isExtensionConnected(userId),
      };
    }

    return {
      ...loop.getStatus(),
      extensionConnected: isExtensionConnected(userId),
    };
  });
}

function getUserId(request: any): string {
  return request.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001';
}
