import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('auto-apply:navigator');

// TODO: Navigate to listing page, find apply button

export async function navigateToListing(page: Page, url: string): Promise<void> {
  // TODO: Navigate, wait for page load, scroll to apply section
  throw new Error('Not implemented');
}
