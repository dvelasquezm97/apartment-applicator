import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('appointment:parser');

// TODO: Extract datetime and address from viewing invitation text
// Regex patterns for German date formats first, Claude API fallback

export async function parseViewingInvite(
  content: string,
): Promise<{ datetime: Date; address: string }> {
  // TODO: Parse date, time, address from invitation message
  throw new Error('Not implemented');
}
