import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock session module
vi.mock('../../src/modules/session/index.js', () => ({
  getPage: vi.fn().mockResolvedValue({}),
  releasePage: vi.fn().mockResolvedValue(undefined),
}));

// Mock scraper
vi.mock('../../src/modules/listing-monitor/scraper.js', () => ({
  scrapeNewListings: vi.fn().mockResolvedValue([]),
}));

// Mock dedup
vi.mock('../../src/modules/listing-monitor/dedup.js', () => ({
  isDuplicate: vi.fn().mockResolvedValue(false),
  hasExistingApplication: vi.fn().mockResolvedValue(false),
  insertListing: vi.fn().mockResolvedValue('new-listing-id'),
}));

// Mock filter
vi.mock('../../src/modules/listing-monitor/filter.js', () => ({
  canApply: vi.fn().mockResolvedValue(true),
  incrementApplicationCount: vi.fn().mockResolvedValue(undefined),
}));

// Mock queue
vi.mock('../../src/lib/queue.js', () => ({
  autoApplyQueue: { add: vi.fn().mockResolvedValue({}) },
}));

// Mock Supabase for application creation
vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'app-123' },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import { runListingMonitor } from '../../src/modules/listing-monitor/index.js';
import { scrapeNewListings } from '../../src/modules/listing-monitor/scraper.js';
import { isDuplicate, hasExistingApplication } from '../../src/modules/listing-monitor/dedup.js';
import { canApply } from '../../src/modules/listing-monitor/filter.js';
import { releasePage } from '../../src/modules/session/index.js';
import { autoApplyQueue } from '../../src/lib/queue.js';

describe('listing-monitor integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero stats when no listings found', async () => {
    vi.mocked(scrapeNewListings).mockResolvedValue([]);

    const stats = await runListingMonitor('user-1');

    expect(stats.scraped).toBe(0);
    expect(stats.enqueued).toBe(0);
    expect(releasePage).toHaveBeenCalledWith('user-1');
  });

  it('processes new listings through full pipeline', async () => {
    vi.mocked(scrapeNewListings).mockResolvedValue([
      { immoscoutId: '111', url: 'https://example.com/111', title: 'Apt 1', address: 'Berlin', rent: 800, size: 50, rooms: 2 },
      { immoscoutId: '222', url: 'https://example.com/222', title: 'Apt 2', address: 'Berlin', rent: 900, size: 60, rooms: 3 },
    ]);
    vi.mocked(isDuplicate).mockResolvedValue(false);
    vi.mocked(canApply).mockResolvedValue(true);

    const stats = await runListingMonitor('user-1');

    expect(stats.scraped).toBe(2);
    expect(stats.newListings).toBe(2);
    expect(stats.enqueued).toBe(2);
    expect(autoApplyQueue.add).toHaveBeenCalledTimes(2);
    expect(releasePage).toHaveBeenCalledWith('user-1');
  });

  it('skips duplicate listings', async () => {
    vi.mocked(scrapeNewListings).mockResolvedValue([
      { immoscoutId: '111', url: 'https://example.com/111', title: 'Apt 1', address: null, rent: null, size: null, rooms: null },
    ]);
    vi.mocked(hasExistingApplication).mockResolvedValue(true);

    const stats = await runListingMonitor('user-1');

    expect(stats.skippedDuplicate).toBe(1);
    expect(stats.enqueued).toBe(0);
  });

  it('stops when daily cap reached', async () => {
    vi.mocked(scrapeNewListings).mockResolvedValue([
      { immoscoutId: '111', url: 'https://example.com/111', title: 'Apt 1', address: null, rent: null, size: null, rooms: null },
      { immoscoutId: '222', url: 'https://example.com/222', title: 'Apt 2', address: null, rent: null, size: null, rooms: null },
    ]);
    vi.mocked(hasExistingApplication).mockResolvedValue(false);
    vi.mocked(canApply).mockResolvedValue(false);

    const stats = await runListingMonitor('user-1');

    expect(stats.enqueued).toBe(0);
    // When cap is hit on first listing, remaining listings are counted as skippedCap
    expect(stats.skippedCap).toBe(2);
  });

  it('always releases page even on error', async () => {
    vi.mocked(scrapeNewListings).mockRejectedValue(new Error('Scrape failed'));

    await expect(runListingMonitor('user-1')).rejects.toThrow('Scrape failed');
    expect(releasePage).toHaveBeenCalledWith('user-1');
  });
});
