import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { isDuplicate, insertListing } from '../../src/modules/listing-monitor/dedup.js';
import { supabaseAdmin } from '../../src/lib/supabase.js';

describe('dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDuplicate', () => {
    it('returns true when listing exists', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'existing-id' }],
              error: null,
            }),
          }),
        }),
      } as any);

      expect(await isDuplicate('123456789')).toBe(true);
    });

    it('returns false when listing does not exist', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      expect(await isDuplicate('999999999')).toBe(false);
    });

    it('throws on Supabase error', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          }),
        }),
      } as any);

      await expect(isDuplicate('123')).rejects.toThrow('Dedup check failed');
    });
  });

  describe('insertListing', () => {
    it('inserts and returns listing ID', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-listing-id' },
              error: null,
            }),
          }),
        }),
      } as any);

      const id = await insertListing({
        immoscoutId: '123456789',
        url: 'https://immobilienscout24.de/expose/123456789',
        title: '2-Zimmer in Kreuzberg',
        address: 'Oranienstraße 42',
        rent: 850,
        size: 55,
        rooms: 2,
      });

      expect(id).toBe('new-listing-id');
    });

    it('throws on insert error', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Unique constraint' },
            }),
          }),
        }),
      } as any);

      await expect(insertListing({
        immoscoutId: '123',
        url: 'https://example.com',
        title: 'Test',
        address: null,
        rent: null,
        size: null,
        rooms: null,
      })).rejects.toThrow('Insert listing failed');
    });
  });
});
