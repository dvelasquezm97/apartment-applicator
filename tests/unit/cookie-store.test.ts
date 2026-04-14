import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookie } from 'playwright-core';

// Mock supabase before importing cookie-store
vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { saveCookies, loadCookies } from '../../src/modules/session/cookie-store.js';
import { supabaseAdmin } from '../../src/lib/supabase.js';
import { encrypt, decrypt } from '../../src/lib/encryption.js';

const mockCookies: Cookie[] = [
  {
    name: 'session_id',
    value: 'abc123',
    domain: '.immobilienscout24.de',
    path: '/',
    expires: -1,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
  {
    name: 'csrf_token',
    value: 'xyz789',
    domain: '.immobilienscout24.de',
    path: '/',
    expires: Date.now() / 1000 + 3600,
    httpOnly: false,
    secure: true,
    sameSite: 'Strict',
  },
];

describe('cookie-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveCookies', () => {
    it('encrypts cookies and stores in Supabase', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.mocked(supabaseAdmin.from).mockReturnValue({ update: updateMock } as any);

      await saveCookies('user-1', mockCookies);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          immoscout_cookies_encrypted: expect.any(String),
          updated_at: expect.any(String),
        }),
      );

      // Verify the stored value is actually encrypted (not plaintext JSON)
      const storedValue = updateMock.mock.calls[0][0].immoscout_cookies_encrypted;
      expect(storedValue).not.toContain('session_id');
      expect(storedValue).not.toContain('abc123');

      // Verify it decrypts back to original cookies
      const decrypted = JSON.parse(decrypt(storedValue));
      expect(decrypted).toEqual(mockCookies);
    });

    it('throws on Supabase error', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      });
      vi.mocked(supabaseAdmin.from).mockReturnValue({ update: updateMock } as any);

      await expect(saveCookies('user-1', mockCookies)).rejects.toThrow('Failed to save cookies');
    });
  });

  describe('loadCookies', () => {
    it('loads and decrypts cookies from Supabase', async () => {
      const encrypted = encrypt(JSON.stringify(mockCookies));
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { immoscout_cookies_encrypted: encrypted },
            error: null,
          }),
        }),
      });
      vi.mocked(supabaseAdmin.from).mockReturnValue({ select: selectMock } as any);

      const result = await loadCookies('user-1');

      expect(result).toEqual(mockCookies);
    });

    it('returns null when no cookies stored', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { immoscout_cookies_encrypted: null },
            error: null,
          }),
        }),
      });
      vi.mocked(supabaseAdmin.from).mockReturnValue({ select: selectMock } as any);

      const result = await loadCookies('user-1');

      expect(result).toBeNull();
    });

    it('throws on Supabase error', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      });
      vi.mocked(supabaseAdmin.from).mockReturnValue({ select: selectMock } as any);

      await expect(loadCookies('user-1')).rejects.toThrow('Failed to load cookies');
    });
  });
});
