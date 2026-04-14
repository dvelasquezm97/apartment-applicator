import { Queue } from 'bullmq';
import { createRedisConnection } from './redis.js';
import { QUEUES, JOB_DEFAULTS } from '../config/constants.js';
import type {
  ListingMonitorJobData,
  AutoApplyJobData,
  InboxMonitorJobData,
  DocumentSenderJobData,
  AppointmentJobData,
  ExternalFormJobData,
  ReconciliationJobData,
} from '../types/queue.js';

const connection = createRedisConnection();
const defaultJobOptions = JOB_DEFAULTS;

export const listingMonitorQueue = new Queue<ListingMonitorJobData>(
  QUEUES.LISTING_MONITOR,
  { connection, defaultJobOptions },
);

export const autoApplyQueue = new Queue<AutoApplyJobData>(
  QUEUES.AUTO_APPLY,
  { connection, defaultJobOptions },
);

export const inboxMonitorQueue = new Queue<InboxMonitorJobData>(
  QUEUES.INBOX_MONITOR,
  { connection, defaultJobOptions },
);

export const documentSenderQueue = new Queue<DocumentSenderJobData>(
  QUEUES.DOCUMENT_SENDER,
  { connection, defaultJobOptions },
);

export const appointmentQueue = new Queue<AppointmentJobData>(
  QUEUES.APPOINTMENT,
  { connection, defaultJobOptions },
);

export const externalFormQueue = new Queue<ExternalFormJobData>(
  QUEUES.EXTERNAL_FORM,
  { connection, defaultJobOptions },
);

export const reconciliationQueue = new Queue<ReconciliationJobData>(
  QUEUES.RECONCILIATION,
  { connection, defaultJobOptions },
);
