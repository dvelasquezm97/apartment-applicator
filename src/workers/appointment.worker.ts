import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import type { AppointmentJobData } from '../types/queue.js';

const log = createChildLogger('worker:appointment');

export function createAppointmentWorker(): Worker<AppointmentJobData> {
  return new Worker<AppointmentJobData>(
    QUEUES.APPOINTMENT,
    async (job) => {
      log.info({ userId: job.data.userId, applicationId: job.data.applicationId }, 'Processing appointment job');
      // TODO: Parse viewing invite → create calendar event → update status
      throw new Error('Not implemented');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );
}
