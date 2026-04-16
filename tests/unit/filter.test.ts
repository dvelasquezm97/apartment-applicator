import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { canApply, isBlackoutHour } from '../../src/modules/listing-monitor/filter.js';
import { supabaseAdmin } from '../../src/lib/supabase.js';

describe('filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isBlackoutHour', () => {
    it('returns true at 03:00 Berlin time', () => {
      // Create a date that's 03:00 in Berlin
      const date = new Date('2026-04-15T01:00:00Z'); // UTC+2 in April = 03:00 Berlin
      expect(isBlackoutHour(date)).toBe(true);
    });

    it('returns false at 10:00 Berlin time', () => {
      const date = new Date('2026-04-15T08:00:00Z'); // UTC+2 = 10:00 Berlin
      expect(isBlackoutHour(date)).toBe(false);
    });

    it('returns true at 02:00 Berlin time (start of blackout)', () => {
      const date = new Date('2026-04-15T00:00:00Z'); // UTC+2 = 02:00 Berlin
      expect(isBlackoutHour(date)).toBe(true);
    });

    it('returns false at 06:00 Berlin time (end of blackout)', () => {
      const date = new Date('2026-04-15T04:00:00Z'); // UTC+2 = 06:00 Berlin
      expect(isBlackoutHour(date)).toBe(false);
    });
  });

  describe('canApply', () => {
    it('returns true when under cap and outside blackout', async () => {
      // Mock isBlackoutHour to return false (we test it separately)
      vi.spyOn(global.Date.prototype, 'getHours').mockReturnValue(10);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                daily_application_count: 5,
                daily_application_reset_at: new Date(Date.now() + 86400000).toISOString(),
                automation_paused: false,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      expect(await canApply('user-1')).toBe(true);
      vi.restoreAllMocks();
    });

    it('returns false when at daily cap', async () => {
      vi.spyOn(global.Date.prototype, 'getHours').mockReturnValue(10);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                daily_application_count: 20,
                daily_application_reset_at: new Date(Date.now() + 86400000).toISOString(),
                automation_paused: false,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      expect(await canApply('user-1')).toBe(false);
      vi.restoreAllMocks();
    });

    it('returns false when automation is paused', async () => {
      vi.spyOn(global.Date.prototype, 'getHours').mockReturnValue(10);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                daily_application_count: 0,
                daily_application_reset_at: null,
                automation_paused: true,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      expect(await canApply('user-1')).toBe(false);
      vi.restoreAllMocks();
    });

    it('resets count when reset time is past', async () => {
      vi.spyOn(global.Date.prototype, 'getHours').mockReturnValue(10);

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'bk_users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    daily_application_count: 15,
                    daily_application_reset_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                    automation_paused: false,
                  },
                  error: null,
                }),
              }),
            }),
            update: updateMock,
          } as any;
        }
        return {} as any;
      });

      expect(await canApply('user-1')).toBe(true);
      expect(updateMock).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
