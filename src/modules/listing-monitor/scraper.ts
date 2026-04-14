import type { Page } from 'playwright-core';
import type { Listing } from '../../types/listing.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('listing-monitor:scraper');

// TODO: Navigate to saved searches, extract listing data
// Document all discovered selectors in docs/BROWSER_AUTOMATION.md

export async function scrapeNewListings(page: Page, userId: string): Promise<Listing[]> {
  // TODO: Navigate saved searches → extract listings
  throw new Error('Not implemented');
}
