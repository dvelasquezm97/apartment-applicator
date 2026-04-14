import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { AutoApplyJobData } from '../types/queue.js';

const log = createChildLogger('worker:auto-apply');

export function createAutoApplyWorker(): Worker<AutoApplyJobData> {
  return new Worker<AutoApplyJobData>(
    QUEUES.AUTO_APPLY,
    async (job) => {
      log.info({ userId: job.data.userId, listingId: job.data.listingId }, 'Processing auto-apply job');
      // TODO: Get page → navigate → fill form → upload docs → submit
      throw new Error('Not implemented');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );
}
