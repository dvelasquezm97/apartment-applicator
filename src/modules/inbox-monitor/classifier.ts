import type { InboxMessage, ClassificationResult } from '../../types/message.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('inbox-monitor:classifier');

// TODO: Classify message intent
// 1. Rule-based first (fast, no API cost)
// 2. Claude API fallback for ambiguous messages

export async function classifyMessage(message: InboxMessage): Promise<ClassificationResult> {
  // TODO: Rule-based classification, then Claude API fallback
  throw new Error('Not implemented');
}
