import { createChildLogger } from '../../lib/logger.js';
import { getPage, releasePage } from '../session/index.js';
import { readNewMessages } from './reader.js';
import { classifyMessage } from './classifier.js';
import { routeMessage } from './router.js';

export { readNewMessages } from './reader.js';
export { classifyMessage } from './classifier.js';
export { routeMessage } from './router.js';

const log = createChildLogger('inbox-monitor');

export interface InboxMonitorResult {
  messagesRead: number;
  classified: Record<string, number>;
  errors: number;
}

/**
 * Full inbox monitor pipeline: get page → read messages → classify → route.
 * Uses M1 Session Manager for authenticated pages.
 */
export async function runInboxMonitor(userId: string): Promise<InboxMonitorResult> {
  log.info({ userId }, 'Starting inbox monitor');
  const classified: Record<string, number> = {};
  let errors = 0;

  const page = await getPage(userId);
  try {
    // Read all unprocessed inbound messages
    const messages = await readNewMessages(page, userId);
    if (messages.length === 0) {
      log.info({ userId }, 'No new messages');
      return { messagesRead: 0, classified, errors: 0 };
    }

    // Classify and route each message
    for (const message of messages) {
      try {
        const result = await classifyMessage(message);
        classified[result.intent] = (classified[result.intent] || 0) + 1;
        await routeMessage(message, result, userId);
      } catch (err) {
        log.error({ messageId: message.id, error: (err as Error).message }, 'Failed to classify/route message');
        errors++;
      }
    }

    log.info({ userId, messagesRead: messages.length, classified, errors }, 'Inbox monitor complete');
    return { messagesRead: messages.length, classified, errors };
  } finally {
    await releasePage(userId);
  }
}
