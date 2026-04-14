import { createChildLogger } from '../lib/logger.js';
import { createListingMonitorWorker } from './listing-monitor.worker.js';
import { createAutoApplyWorker } from './auto-apply.worker.js';
import { createInboxMonitorWorker } from './inbox-monitor.worker.js';
import { createDocumentSenderWorker } from './document-sender.worker.js';
import { createAppointmentWorker } from './appointment.worker.js';
import { createExternalFormWorker } from './external-form.worker.js';
import { runReconciliation } from './reconciliation.worker.js';

const log = createChildLogger('workers');

export async function startAllWorkers(): Promise<void> {
  log.info('Starting all workers');

  // Run startup reconciliation first
  // TODO: Uncomment when implemented
  // await runReconciliation();

  // Start all workers
  createListingMonitorWorker();
  createAutoApplyWorker();
  createInboxMonitorWorker();
  createDocumentSenderWorker();
  createAppointmentWorker();
  createExternalFormWorker();

  log.info('All workers started');
}
