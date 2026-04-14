import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { ExternalFormJobData } from '../types/queue.js';

const log = createChildLogger('worker:external-form');

export function createExternalFormWorker(): Worker<ExternalFormJobData> {
  return new Worker<ExternalFormJobData>(
    QUEUES.EXTERNAL_FORM,
    async (job) => {
      log.info({ userId: job.data.userId, formUrl: job.data.formUrl }, 'Processing external form job');
      // TODO: Open form → analyze with Claude → fill → ask pending questions → submit
      throw new Error('Not implemented');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );
}
