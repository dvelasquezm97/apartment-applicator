import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('document-sender:sender');

// TODO: Reply in Immoscout inbox thread with user documents

export async function sendDocuments(
  page: Page,
  applicationId: string,
  userId: string,
): Promise<void> {
  // TODO: Navigate to thread, attach documents, send reply
  throw new Error('Not implemented');
}
