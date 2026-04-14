import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('session:browser-pool');

// TODO: Implement browser pool with checkout/return pattern
// Max BROWSER_POOL_SIZE concurrent Chromium instances
// One BrowserContext per user (isolated cookies)
// Idle timeout: 30 min → persist cookies, close context

export async function getPage(userId: string): Promise<Page> {
  // TODO: Return authenticated Playwright page for user
  throw new Error('Not implemented');
}

export async function releasePage(userId: string): Promise<void> {
  // TODO: Return page to pool after use
  throw new Error('Not implemented');
}

export async function shutdown(): Promise<void> {
  // TODO: Persist all cookies, close all browsers
  throw new Error('Not implemented');
}
