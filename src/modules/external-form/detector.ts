import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('external-form:detector');

// TODO: Extract external form URLs from message content

export function detectFormUrl(content: string): string | null {
  // TODO: Regex for URLs to known form providers
  return null;
}
