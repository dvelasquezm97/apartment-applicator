import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { DocumentSenderJobData } from '../types/queue.js';

const log = createChildLogger('worker:document-sender');

export function createDocumentSenderWorker(): Worker<DocumentSenderJobData> {
  return new Worker<DocumentSenderJobData>(
    QUEUES.DOCUMENT_SENDER,
    async (job) => {
      log.info({ userId: job.data.userId, applicationId: job.data.applicationId }, 'Processing document sender job');
      // TODO: Get page → navigate to thread → attach docs → send reply
      throw new Error('Not implemented');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );
}
