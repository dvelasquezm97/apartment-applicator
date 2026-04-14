import type { Page } from 'playwright-core';
import type { InboxMessage } from '../../types/message.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('inbox-monitor:reader');

// TODO: Navigate to Immoscout inbox, extract messages per thread

export async function readNewMessages(page: Page, userId: string): Promise<InboxMessage[]> {
  // TODO: Navigate inbox, parse threads, extract unprocessed messages
  throw new Error('Not implemented');
}
