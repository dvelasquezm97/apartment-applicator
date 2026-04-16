import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../src/modules/session/captcha-detector.js', () => ({
  detectCaptcha: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/config/constants.js', () => ({
  DELAYS: {
    BETWEEN_PAGES: { min: 0, max: 0 },
    BEFORE_CLICK: { min: 0, max: 0 },
    TYPING_PER_CHAR: { min: 0, max: 0 },
    BETWEEN_FIELDS: { min: 0, max: 0 },
  },
}));

// Speed up delays
vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });

import { scrapeNewListings } from '../../src/modules/listing-monitor/scraper.js';

/**
 * Create a mock listing card matching the new Immoscout selectors:
 * - Link: a[href*="exposeId="]
 * - Title: [data-testid="headline"]
 * - Address: [data-testid="hybridViewAddress"]
 * - Attributes: [data-testid="attributes"] — contains rent, size, rooms as text
 * - Heart: .shortlist-star[aria-label="..."]
 */
function createMockListingCard(listing: {
  href: string;
  title: string;
  address: string;
  attributesText: string;
  alreadyApplied?: boolean;
}) {
  return {
    $: vi.fn((selector: string) => {
      // Listing link with exposeId query param
      if (selector.includes('exposeId=')) return Promise.resolve({
        getAttribute: vi.fn().mockResolvedValue(listing.href),
      });
      // Heart — already applied indicator
      if (selector.includes('vom Merkzettel entfernen')) {
        return Promise.resolve(listing.alreadyApplied ? {} : null);
      }
      if (selector.includes('Zum Merkzettel hinzufügen')) {
        return Promise.resolve(!listing.alreadyApplied ? {} : null);
      }
      // Title
      if (selector.includes('headline')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.title),
      });
      // Address
      if (selector.includes('hybridViewAddress')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.address),
      });
      // Attributes (rent, size, rooms in one block)
      if (selector.includes('attributes')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.attributesText),
      });
      return Promise.resolve(null);
    }),
  };
}

function createMockPage(options: {
  savedSearchLinks?: any[];
  listingCards?: any[];
  noResults?: boolean;
} = {}) {
  const { savedSearchLinks = [], listingCards = [], noResults = false } = options;
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/meinkonto/gespeichertesuchen'),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    $: vi.fn(async (selector: string) => {
      // No results indicator
      if (selector.includes('result-list-empty') || selector.includes('no-results')) {
        return noResults ? {} : null;
      }
      // Pagination next button — return null (single page)
      if (selector.includes('pagination')) return null;
      return null;
    }),
    $$: vi.fn(async (selector: string) => {
      // Saved search links — matches 'a[href*="/Suche/"]'
      if (selector.includes('/Suche/')) return savedSearchLinks;
      // Listing cards — matches '.listing-card:not(.touchpoint-card)'
      if (selector.includes('listing-card')) return listingCards;
      return [];
    }),
  } as any;
}

describe('scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
  });

  it('returns empty when no saved searches found', async () => {
    const page = createMockPage({ savedSearchLinks: [] });
    const result = await scrapeNewListings(page, 'user-1');
    expect(result).toEqual([]);
  });

  it('returns empty when no results in search', async () => {
    const page = createMockPage({
      savedSearchLinks: [{ getAttribute: vi.fn().mockResolvedValue('/Suche/de/berlin/123') }],
      noResults: true,
    });
    const result = await scrapeNewListings(page, 'user-1');
    expect(result).toEqual([]);
  });

  it('extracts listings from search results with new selectors', async () => {
    const mockCards = [
      createMockListingCard({
        href: '/Suche/controller/exposeNavigation/goToExpose.go?exposeId=123456789&searchType=district',
        title: '2-Zimmer in Kreuzberg',
        address: 'Oranienstra\u00dfe 42, 10999 Berlin',
        attributesText: '\u20ac850  55 m\u00b2  2 Zi',
        alreadyApplied: false,
      }),
      createMockListingCard({
        href: '/Suche/controller/exposeNavigation/goToExpose.go?exposeId=987654321&searchType=district',
        title: '3-Zimmer Altbau',
        address: 'Karl-Marx-Str 100',
        attributesText: '\u20ac1.100  75,5 m\u00b2  3 Zi',
        alreadyApplied: true,
      }),
    ];

    const page = createMockPage({
      savedSearchLinks: [{ getAttribute: vi.fn().mockResolvedValue('/Suche/de/berlin/456') }],
      listingCards: mockCards,
    });

    const result = await scrapeNewListings(page, 'user-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      immoscoutId: '123456789',
      url: 'https://www.immobilienscout24.de/expose/123456789',
      title: '2-Zimmer in Kreuzberg',
      address: 'Oranienstra\u00dfe 42, 10999 Berlin',
      rent: 850,
      size: 55,
      rooms: 2,
      alreadyApplied: false,
    });
    expect(result[1].immoscoutId).toBe('987654321');
    expect(result[1].rent).toBe(1100);
    expect(result[1].size).toBe(75.5);
    expect(result[1].alreadyApplied).toBe(true);
  });

  it('skips cards without expose links', async () => {
    const badCard = {
      $: vi.fn().mockResolvedValue(null), // no link element
    };
    const page = createMockPage({
      savedSearchLinks: [{ getAttribute: vi.fn().mockResolvedValue('/Suche/de/berlin/789') }],
      listingCards: [badCard],
    });

    const result = await scrapeNewListings(page, 'user-1');
    expect(result).toEqual([]);
  });
});
