import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/session/captcha-detector.js', () => ({
  detectCaptcha: vi.fn().mockResolvedValue(false),
}));

// Speed up delays
vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });

import { scrapeNewListings } from '../../src/modules/listing-monitor/scraper.js';

function createMockElement(overrides: Record<string, any> = {}) {
  return {
    getAttribute: vi.fn().mockResolvedValue(overrides.href ?? null),
    textContent: vi.fn().mockResolvedValue(overrides.text ?? null),
    $: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function createMockListingCard(listing: {
  href: string;
  title: string;
  address: string;
  rent: string;
  size: string;
  rooms: string;
}) {
  return {
    $: vi.fn((selector: string) => {
      if (selector.includes('expose')) return Promise.resolve({
        getAttribute: vi.fn().mockResolvedValue(listing.href),
      });
      if (selector.includes('title') || selector.includes('h2')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.title),
      });
      if (selector.includes('address')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.address),
      });
      if (selector.includes('first-child') || selector.includes('price')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.rent),
      });
      if (selector.includes('nth-child(2)') || selector.includes('listing-size')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.size),
      });
      if (selector.includes('nth-child(3)') || selector.includes('listing-rooms')) return Promise.resolve({
        textContent: vi.fn().mockResolvedValue(listing.rooms),
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
    goto: vi.fn(),
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/meinkonto'),
    $: vi.fn(async (selector: string) => {
      if (selector.includes('no-results') || selector.includes('empty')) {
        return noResults ? {} : null;
      }
      return null;
    }),
    $$: vi.fn(async (selector: string) => {
      if (selector.includes('saved-search')) return savedSearchLinks;
      if (selector.includes('result-list')) return listingCards;
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
      savedSearchLinks: [{ getAttribute: vi.fn().mockResolvedValue('/Suche/123') }],
      noResults: true,
    });
    const result = await scrapeNewListings(page, 'user-1');
    expect(result).toEqual([]);
  });

  it('extracts listings from search results', async () => {
    const mockCards = [
      createMockListingCard({
        href: '/expose/123456789',
        title: '2-Zimmer in Kreuzberg',
        address: 'Oranienstraße 42, 10999 Berlin',
        rent: '850 €',
        size: '55 m²',
        rooms: '2',
      }),
      createMockListingCard({
        href: '/expose/987654321',
        title: '3-Zimmer Altbau',
        address: 'Karl-Marx-Str 100',
        rent: '1.100 €',
        size: '75,5 m²',
        rooms: '3',
      }),
    ];

    const page = createMockPage({
      savedSearchLinks: [{ getAttribute: vi.fn().mockResolvedValue('/Suche/456') }],
      listingCards: mockCards,
    });

    const result = await scrapeNewListings(page, 'user-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      immoscoutId: '123456789',
      url: 'https://www.immobilienscout24.de/expose/123456789',
      title: '2-Zimmer in Kreuzberg',
      address: 'Oranienstraße 42, 10999 Berlin',
      rent: 850,
      size: 55,
      rooms: 2,
    });
    expect(result[1].immoscoutId).toBe('987654321');
    expect(result[1].rent).toBe(1100);
    expect(result[1].size).toBe(75.5);
  });

  it('skips cards without expose links', async () => {
    const badCard = {
      $: vi.fn().mockResolvedValue(null), // no link element
    };
    const page = createMockPage({
      savedSearchLinks: [{ getAttribute: vi.fn().mockResolvedValue('/Suche/789') }],
      listingCards: [badCard],
    });

    const result = await scrapeNewListings(page, 'user-1');
    expect(result).toEqual([]);
  });
});
