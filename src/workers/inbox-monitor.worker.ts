import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { InboxMonitorJobData } from '../types/queue.js';

const log = createChildLogger('worker:inbox-monitor');

export function createInboxMonitorWorker(): Worker<InboxMonitorJobData> {
  return new Worker<InboxMonitorJobData>(
    QUEUES.INBOX_MONITOR,
    async (job) => {
      log.info({ userId: job.data.userId }, 'Processing inbox monitor job');
      // TODO: Get page → read messages → classify → route to handlers
      throw new Error('Not implemented');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );
}
