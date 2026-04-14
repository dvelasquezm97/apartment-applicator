import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { ListingMonitorJobData } from '../types/queue.js';

const log = createChildLogger('worker:listing-monitor');

export function createListingMonitorWorker(): Worker<ListingMonitorJobData> {
  return new Worker<ListingMonitorJobData>(
    QUEUES.LISTING_MONITOR,
    async (job) => {
      log.info({ userId: job.data.userId }, 'Processing listing monitor job');
      // TODO: Get browser page → scrape saved searches → dedup → enqueue apply jobs
      throw new Error('Not implemented');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );
}
