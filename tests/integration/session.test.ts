import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external deps
const mockCookies = [{ name: 'session', value: 'abc', domain: '.immobilienscout24.de', path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' as const }];

vi.mock('playwright-extra', () => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/meinkonto/dashboard'),
    goto: vi.fn(),
    click: vi.fn(),
    keyboard: { type: vi.fn() },
    waitForLoadState: vi.fn(),
    $: vi.fn().mockResolvedValue({}), // logged-in indicator found
    context: vi.fn().mockReturnValue({
      cookies: vi.fn().mockResolvedValue([{ name: 'session', value: 'abc', domain: '.immobilienscout24.de', path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' }]),
      addCookies: vi.fn(),
      close: vi.fn(),
    }),
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    cookies: vi.fn().mockResolvedValue([]),
    addCookies: vi.fn(),
    close: vi.fn(),
  };
  const mockBrowser = {
    isConnected: vi.fn().mockReturnValue(true),
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn(),
    on: vi.fn(),
  };
  return {
    chromium: { use: vi.fn(), launch: vi.fn().mockResolvedValue(mockBrowser) },
  };
});

vi.mock('puppeteer-extra-plugin-stealth', () => ({ default: vi.fn() }));

vi.mock('../../src/modules/session/captcha-detector.js', () => ({
  detectCaptcha: vi.fn().mockResolvedValue(false),
  getCaptchaBreaker: vi.fn().mockReturnValue({
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  }),
}));

// Need a real encrypted password for the login path
import { encrypt } from '../../src/lib/encryption.js';
const encryptedPassword = encrypt('test-password-123');
const encryptedCookies = encrypt(JSON.stringify(mockCookies));

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'bk_users') {
        return {
          select: vi.fn((cols: string) => ({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: cols.includes('email')
                  ? { immoscout_email: 'test@example.com', immoscout_password_encrypted: encryptedPassword }
                  : { immoscout_cookies_encrypted: encryptedCookies },
                error: null,
              }),
            }),
          })),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { select: vi.fn(), update: vi.fn(), insert: vi.fn() };
    }),
  },
}));

// Speed up delays
vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });

import { getPage, releasePage, shutdown, isSessionHealthy } from '../../src/modules/session/index.js';

describe('session integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
  });

  it('getPage returns an authenticated page (cookie restore path)', async () => {
    const page = await getPage('user-1');
    expect(page).toBeDefined();
    expect(page.goto).toHaveBeenCalled();
  });

  it('releasePage does not throw', async () => {
    await getPage('user-1');
    await expect(releasePage('user-1')).resolves.not.toThrow();
  });

  it('shutdown does not throw', async () => {
    await getPage('user-1');
    await expect(shutdown()).resolves.not.toThrow();
  });

  it('isSessionHealthy returns boolean', async () => {
    const result = await isSessionHealthy('user-1');
    expect(typeof result).toBe('boolean');
  });
});
