import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { DELAYS } from '../../config/constants.js';
import { detectCaptcha } from '../session/captcha-detector.js';

const log = createChildLogger('listing-monitor:scraper');

const IMMOSCOUT_SAVED_SEARCH_URL = 'https://www.immobilienscout24.de/meinkonto/gespeichertesuchen';

// Selectors — update here when Immoscout changes their page structure
const SELECTORS = {
  savedSearchLink: '.saved-search-list a[href*="/Suche/"], [data-testid="saved-search"] a',
  listingCard: '.result-list__listing, [data-testid="result-list-entry"], .result-list-entry__data',
  listingLink: 'a[href*="/expose/"]',
  listingTitle: '.result-list-entry__brand-title, [data-testid="listing-title"], h2',
  listingAddress: '.result-list-entry__address, [data-testid="listing-address"]',
  listingRent: '.result-list-entry__primary-criterion:first-child .font-highlight, [data-testid="listing-price"]',
  listingSize: '.result-list-entry__primary-criterion:nth-child(2) .font-highlight, [data-testid="listing-size"]',
  listingRooms: '.result-list-entry__primary-criterion:nth-child(3) .font-highlight, [data-testid="listing-rooms"]',
  noResults: '.result-list-empty, [data-testid="no-results"]',
  pagination: '.react-pagination__next, [data-testid="pagination-next"]',
};

export interface ScrapedListing {
  immoscoutId: string;
  url: string;
  title: string;
  address: string | null;
  rent: number | null;
  size: number | null;
  rooms: number | null;
}

async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

function parseNumber(text: string | null): number | null {
  if (!text) return null;
  // German format: 1.100,50 → remove dots (thousands), replace comma with dot (decimal)
  const cleaned = text.replace(/[^\d,.]/g, '');
  // If has both dot and comma: dot is thousands, comma is decimal (German)
  // If has only comma: it's decimal
  // If has only dot: check position — if 3 digits after, it's thousands; otherwise decimal
  let normalized: string;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // German: 1.100,50
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // German decimal: 75,5
    normalized = cleaned.replace(',', '.');
  } else if (cleaned.includes('.') && /\.\d{3}$/.test(cleaned)) {
    // Thousands separator only: 1.100
    normalized = cleaned.replace(/\./g, '');
  } else {
    normalized = cleaned;
  }
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function extractImmoscoutId(url: string): string | null {
  const match = url.match(/\/expose\/(\d+)/);
  return match?.[1] ?? null;
}

export async function scrapeNewListings(page: Page, userId: string): Promise<ScrapedListing[]> {
  log.info({ userId }, 'Navigating to saved searches');

  await page.goto(IMMOSCOUT_SAVED_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  if (await detectCaptcha(page, userId)) {
    log.warn({ userId }, 'CAPTCHA detected on saved searches page');
    return [];
  }

  // Find saved search links
  const searchLinks = await page.$$(SELECTORS.savedSearchLink);
  if (searchLinks.length === 0) {
    log.warn({ userId }, 'No saved searches found');
    return [];
  }

  // Collect hrefs from all saved searches
  const searchHrefs: string[] = [];
  for (const link of searchLinks) {
    const href = await link.getAttribute('href');
    if (href) searchHrefs.push(href);
  }

  log.info({ userId, searchCount: searchHrefs.length }, 'Found saved searches');

  // Iterate all saved searches and collect listings
  const allListings: ScrapedListing[] = [];

  for (const href of searchHrefs) {
    const fullUrl = href.startsWith('http') ? href : `https://www.immobilienscout24.de${href}`;
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

    if (await detectCaptcha(page, userId)) {
      log.warn({ userId, href }, 'CAPTCHA detected on search results page');
      break;
    }

    const noResults = await page.$(SELECTORS.noResults);
    if (noResults) {
      log.info({ userId, href }, 'No listings in this saved search');
      continue;
    }

    const listings = await extractListingsFromPage(page);
    allListings.push(...listings);
    log.info({ userId, href, count: listings.length }, 'Listings scraped from search');
  }

  log.info({ userId, totalCount: allListings.length }, 'All saved searches scraped');
  return allListings;
}

async function extractListingsFromPage(page: Page): Promise<ScrapedListing[]> {
  const cards = await page.$$(SELECTORS.listingCard);
  const listings: ScrapedListing[] = [];

  for (const card of cards) {
    try {
      // Get expose link and ID
      const linkEl = await card.$(SELECTORS.listingLink);
      if (!linkEl) continue;

      const href = await linkEl.getAttribute('href');
      if (!href) continue;

      const immoscoutId = extractImmoscoutId(href);
      if (!immoscoutId) continue;

      const url = href.startsWith('http')
        ? href
        : `https://www.immobilienscout24.de${href}`;

      // Extract listing details
      const titleEl = await card.$(SELECTORS.listingTitle);
      const title = titleEl ? (await titleEl.textContent())?.trim() ?? 'Unknown' : 'Unknown';

      const addressEl = await card.$(SELECTORS.listingAddress);
      const address = addressEl ? (await addressEl.textContent())?.trim() ?? null : null;

      const rentEl = await card.$(SELECTORS.listingRent);
      const rent = parseNumber(rentEl ? await rentEl.textContent() : null);

      const sizeEl = await card.$(SELECTORS.listingSize);
      const size = parseNumber(sizeEl ? await sizeEl.textContent() : null);

      const roomsEl = await card.$(SELECTORS.listingRooms);
      const rooms = parseNumber(roomsEl ? await roomsEl.textContent() : null);

      listings.push({ immoscoutId, url, title, address, rent, size, rooms });
    } catch (err) {
      log.warn({ error: (err as Error).message }, 'Failed to parse listing card — skipping');
    }
  }

  return listings;
}
