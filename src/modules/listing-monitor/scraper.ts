import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { DELAYS } from '../../config/constants.js';
import { detectCaptcha } from '../session/captcha-detector.js';

const log = createChildLogger('listing-monitor:scraper');

/**
 * Selectors verified 2026-04-16 via Arc CDP against live Immoscout24.
 * Immoscout now uses a "HybridView" layout with data-testid attributes.
 */
const SELECTORS = {
  /** Container for all listing cards */
  listingsGrid: '[data-testid="ListingsGrid"]',

  /** Individual listing card (class-based, excludes touchpoint ads) */
  listingCard: '.listing-card:not(.touchpoint-card)',

  /** Link to listing detail — uses exposeId query param, NOT /expose/ path */
  listingLink: 'a[href*="exposeId="]',

  /** Heart button: "Zum Merkzettel hinzufügen" = NOT applied, "vom Merkzettel entfernen" = already applied */
  heartNotApplied: '.shortlist-star[aria-label="Zum Merkzettel hinzufügen"]',
  heartAlreadyApplied: '.shortlist-star[aria-label="vom Merkzettel entfernen"]',

  /** Listing details within each card */
  listingTitle: '[data-testid="headline"]',
  listingAddress: '[data-testid="hybridViewAddress"]',
  listingAttributes: '[data-testid="attributes"]',

  /** No results indicator */
  noResults: '.result-list-empty, [data-testid="no-results"]',

  /** Pagination */
  paginationNext: '[data-testid="pagination-button-next"]',
};

export interface ScrapedListing {
  immoscoutId: string;
  url: string;
  title: string;
  address: string | null;
  rent: number | null;
  size: number | null;
  rooms: number | null;
  alreadyApplied: boolean;
}

async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

function parseNumber(text: string | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.]/g, '');
  let normalized: string;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  } else if (cleaned.includes('.') && /\.\d{3}$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  } else {
    normalized = cleaned;
  }
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function extractExposeId(href: string): string | null {
  // New format: /Suche/controller/exposeNavigation/goToExpose.go?exposeId=167016127&...
  const match = href.match(/exposeId=(\d+)/);
  if (match) return match[1] ?? null;
  // Old format: /expose/12345
  const oldMatch = href.match(/\/expose\/(\d+)/);
  return oldMatch?.[1] ?? null;
}

/**
 * Scrape listings from a given search URL.
 * Handles pagination — follows "next page" until no more pages.
 */
export async function scrapeSearchUrl(page: Page, searchUrl: string, userId: string): Promise<ScrapedListing[]> {
  log.info({ userId, searchUrl: searchUrl.substring(0, 80) }, 'Navigating to search URL');

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  if (await detectCaptcha(page, userId)) {
    log.warn({ userId }, 'CAPTCHA detected on search page');
    return [];
  }

  const allListings: ScrapedListing[] = [];
  let pageNum = 1;

  while (true) {
    log.info({ userId, pageNum }, 'Scraping search results page');

    const noResults = await page.$(SELECTORS.noResults);
    if (noResults) {
      log.info({ userId }, 'No listings found');
      break;
    }

    const listings = await extractListingsFromPage(page);
    allListings.push(...listings);
    log.info({ userId, pageNum, count: listings.length }, 'Listings scraped from page');

    // Check for next page
    const nextBtn = await page.$(SELECTORS.paginationNext);
    if (!nextBtn) break;

    const isDisabled = await nextBtn.evaluate((el: Element) =>
      el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    );
    if (isDisabled) break;

    await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);
    await nextBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

    if (await detectCaptcha(page, userId)) {
      log.warn({ userId, pageNum }, 'CAPTCHA detected on pagination');
      break;
    }

    pageNum++;
  }

  log.info({ userId, totalCount: allListings.length }, 'Search scraping complete');
  return allListings;
}

/**
 * Legacy entry point — scrapes from saved searches page.
 * Kept for backwards compatibility with M2 listing monitor worker.
 */
export async function scrapeNewListings(page: Page, userId: string): Promise<ScrapedListing[]> {
  log.info({ userId }, 'Navigating to saved searches');

  const savedSearchUrl = 'https://www.immobilienscout24.de/meinkonto/gespeichertesuchen';
  await page.goto(savedSearchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  if (await detectCaptcha(page, userId)) {
    log.warn({ userId }, 'CAPTCHA detected on saved searches page');
    return [];
  }

  // Find saved search links
  const searchLinks = await page.$$('a[href*="/Suche/"]');
  if (searchLinks.length === 0) {
    log.warn({ userId }, 'No saved searches found');
    return [];
  }

  const searchHrefs: string[] = [];
  for (const link of searchLinks) {
    const href = await link.getAttribute('href');
    if (href && href.includes('/Suche/de/')) searchHrefs.push(href);
  }

  log.info({ userId, searchCount: searchHrefs.length }, 'Found saved searches');

  const allListings: ScrapedListing[] = [];
  for (const href of searchHrefs) {
    const fullUrl = href.startsWith('http') ? href : `https://www.immobilienscout24.de${href}`;
    const listings = await scrapeSearchUrl(page, fullUrl, userId);
    allListings.push(...listings);
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

      const immoscoutId = extractExposeId(href);
      if (!immoscoutId) continue;

      const url = `https://www.immobilienscout24.de/expose/${immoscoutId}`;

      // Check if already applied (red heart)
      const heartApplied = await card.$(SELECTORS.heartAlreadyApplied);
      const alreadyApplied = heartApplied !== null;

      // Extract listing details
      const titleEl = await card.$(SELECTORS.listingTitle);
      const title = titleEl ? (await titleEl.textContent())?.trim() ?? 'Unknown' : 'Unknown';

      const addressEl = await card.$(SELECTORS.listingAddress);
      const address = addressEl ? (await addressEl.textContent())?.trim() ?? null : null;

      // Extract attributes (rent, size, rooms) from the attributes container
      const attrEl = await card.$(SELECTORS.listingAttributes);
      let rent: number | null = null;
      let size: number | null = null;
      let rooms: number | null = null;

      if (attrEl) {
        const attrText = await attrEl.textContent() ?? '';
        // Parse "€1,088  59.67 m²  2 Rooms" or German variants
        const euroMatch = attrText.match(/€\s*([\d.,]+)/);
        rent = euroMatch ? parseNumber(euroMatch[1] ?? null) : null;

        const sizeMatch = attrText.match(/([\d.,]+)\s*m²/);
        size = sizeMatch ? parseNumber(sizeMatch[1] ?? null) : null;

        const roomsMatch = attrText.match(/([\d.,]+)\s*(Zi|Room|Zimmer)/i);
        rooms = roomsMatch ? parseNumber(roomsMatch[1] ?? null) : null;
      }

      listings.push({ immoscoutId, url, title, address, rent, size, rooms, alreadyApplied });
    } catch (err) {
      log.warn({ error: (err as Error).message }, 'Failed to parse listing card — skipping');
    }
  }

  return listings;
}
