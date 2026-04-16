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
    BEFORE_SUBMIT: { min: 0, max: 0 },
  },
}));

import { login, isLoggedIn } from '../../src/modules/session/login.js';
import { detectCaptcha } from '../../src/modules/session/captcha-detector.js';

function createMockPage(options: {
  loginError?: string | null;
  isLoggedIn?: boolean;
} = {}) {
  const { loginError = null, isLoggedIn = true } = options;
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    keyboard: { type: vi.fn().mockResolvedValue(undefined) },
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue({
      scrollIntoViewIfNeeded: vi.fn(),
      click: vi.fn(),
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/meinkonto'),
    $: vi.fn(async (selector: string) => {
      // Cookie consent — return null (no popup)
      if (selector.includes('consent') || selector.includes('akzeptieren')) {
        return null;
      }
      // Login error selectors
      if ((selector.includes('error') || selector.includes('alert')) && loginError) {
        return { textContent: vi.fn().mockResolvedValue(loginError) };
      }
      // Logged-in indicators
      if (selector.includes('user-menu') || selector.includes('meinkonto') || selector.includes('geschlossenerbereich')) {
        return isLoggedIn ? {} : null;
      }
      return null;
    }),
  } as any;
}

// Speed up human delays for tests
vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(detectCaptcha).mockResolvedValue(false);
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
  });

  it('navigates to SSO login, fills email and password in two steps', async () => {
    const page = createMockPage({ isLoggedIn: true });

    await login(page, 'test@example.com', 'password123');

    // Should navigate to SSO URL
    expect(page.goto).toHaveBeenCalledWith(
      'https://sso.immobilienscout24.de/sso/login?appName=is24main',
      expect.any(Object),
    );
    // Should wait for email input and password input
    expect(page.waitForSelector).toHaveBeenCalledWith('#username', expect.any(Object));
    expect(page.waitForSelector).toHaveBeenCalledWith('#password', expect.any(Object));
    // Should click submit buttons (email step + password step)
    expect(page.click).toHaveBeenCalledWith('#submit');
    // Should type email and password
    expect(page.keyboard.type).toHaveBeenCalled();
  });

  it('waits for manual CAPTCHA solve when detected before login', async () => {
    // CAPTCHA detected on first call, then resolved on second call
    let callCount = 0;
    vi.mocked(detectCaptcha).mockImplementation(async () => {
      callCount++;
      return callCount === 1; // true first time, false after
    });
    const page = createMockPage({ isLoggedIn: true });

    await login(page, 'test@example.com', 'pass');

    // Should have called detectCaptcha multiple times (initial + polling)
    expect(detectCaptcha).toHaveBeenCalled();
    // Should still succeed after CAPTCHA is solved
    expect(page.goto).toHaveBeenCalled();
  });

  it('throws on login error message', async () => {
    const page = createMockPage({ loginError: 'Invalid credentials', isLoggedIn: false });

    await expect(login(page, 'test@example.com', 'wrong')).rejects.toThrow('Login failed: Invalid credentials');
  });

  it('throws when not authenticated after submit', async () => {
    const page = createMockPage({ isLoggedIn: false });

    await expect(login(page, 'test@example.com', 'pass')).rejects.toThrow('Login failed: not authenticated');
  });
});

describe('isLoggedIn', () => {
  it('returns true when logged-in indicator found', async () => {
    const page = createMockPage({ isLoggedIn: true });
    expect(await isLoggedIn(page)).toBe(true);
  });

  it('returns false when no indicator found', async () => {
    const page = { $: vi.fn().mockResolvedValue(null) } as any;
    expect(await isLoggedIn(page)).toBe(false);
  });
});
