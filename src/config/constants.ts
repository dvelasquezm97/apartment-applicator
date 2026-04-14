/** Human simulation delay ranges (milliseconds) */
export const DELAYS = {
  BETWEEN_PAGES: { min: 2000, max: 5000 },
  BEFORE_CLICK: { min: 500, max: 1500 },
  TYPING_PER_CHAR: { min: 50, max: 150 },
  BETWEEN_FIELDS: { min: 300, max: 800 },
  BEFORE_SUBMIT: { min: 1000, max: 3000 },
  BETWEEN_APPLICATIONS: { min: 30000, max: 120000 },
} as const;

/** Jitter: ±20% applied to all repeatable intervals */
export const JITTER_FACTOR = 0.2;

/** Circuit breaker configuration */
export const CIRCUIT_BREAKER = {
  CAPTCHA: { threshold: 1, openDurationMs: 30 * 60 * 1000 },
  RATE_LIMIT: { threshold: 1, openDurationMs: 60 * 60 * 1000 },
  GENERIC: { threshold: 5, openDurationMs: 15 * 60 * 1000 },
} as const;

/** BullMQ default job options */
export const JOB_DEFAULTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: false,
  removeOnFail: false,
};

/** Browser pool idle timeout (30 minutes) */
export const BROWSER_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Pending question timeout (24 hours) */
export const PENDING_QUESTION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/** Queue names */
export const QUEUES = {
  LISTING_MONITOR: 'listing-monitor',
  AUTO_APPLY: 'auto-apply',
  INBOX_MONITOR: 'inbox-monitor',
  DOCUMENT_SENDER: 'document-sender',
  APPOINTMENT: 'appointment',
  EXTERNAL_FORM: 'external-form',
  RECONCILIATION: 'reconciliation',
} as const;
