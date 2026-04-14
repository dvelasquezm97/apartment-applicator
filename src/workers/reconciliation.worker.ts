import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('worker:reconciliation');

// TODO: Run once on worker startup
// Find stuck applications (APPLYING/EXTERNAL_FORM_FILLING with no active job)
// Re-enqueue or mark FAILED based on age
// Re-register repeatable jobs for active users

export async function runReconciliation(): Promise<void> {
  log.info('Running startup reconciliation');
  // TODO: Implement reconciliation logic
  throw new Error('Not implemented');
}
