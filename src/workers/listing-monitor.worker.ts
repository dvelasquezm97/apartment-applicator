import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { ListingMonitorJobData } from '../types/queue.js';
import { runListingMonitor } from '../modules/listing-monitor/index.js';

const log = createChildLogger('worker:listing-monitor');

export function createListingMonitorWorker(): Worker<ListingMonitorJobData> {
  return new Worker<ListingMonitorJobData>(
    QUEUES.LISTING_MONITOR,
    async (job) => {
      const { userId } = job.data;
      log.info({ userId, jobId: job.id }, 'Starting listing monitor job');

      try {
        const stats = await runListingMonitor(userId);
        log.info({ userId, jobId: job.id, ...stats }, 'Listing monitor job complete');
        return stats;
      } catch (err) {
        log.error({ userId, jobId: job.id, error: (err as Error).message }, 'Listing monitor job failed');
        throw err;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1,
    },
  );
}
