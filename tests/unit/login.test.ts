import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/session/captcha-detector.js', () => ({
  detectCaptcha: vi.fn().mockResolvedValue(false),
}));

import { login, isLoggedIn } from '../../src/modules/session/login.js';
import { detectCaptcha } from '../../src/modules/session/captcha-detector.js';

function createMockPage(options: {
  loginError?: string | null;
  isLoggedIn?: boolean;
} = {}) {
  const { loginError = null, isLoggedIn = true } = options;
  return {
    goto: vi.fn(),
    click: vi.fn(),
    keyboard: { type: vi.fn() },
    waitForLoadState: vi.fn(),
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/meinkonto'),
    $: vi.fn(async (selector: string) => {
      if (selector.includes('error') && loginError) {
        return { textContent: vi.fn().mockResolvedValue(loginError) };
      }
      if (selector.includes('user-menu') || selector.includes('meinkonto')) {
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

  it('fills email, password, submits, and verifies login', async () => {
    const page = createMockPage({ isLoggedIn: true });

    await login(page, 'test@example.com', 'password123');

    expect(page.goto).toHaveBeenCalledWith(
      expect.stringContaining('immobilienscout24.de'),
      expect.any(Object),
    );
    expect(page.click).toHaveBeenCalled();
    expect(page.keyboard.type).toHaveBeenCalled();
  });

  it('throws when CAPTCHA detected on login page', async () => {
    vi.mocked(detectCaptcha).mockResolvedValue(true);
    const page = createMockPage();

    await expect(login(page, 'test@example.com', 'pass')).rejects.toThrow('CAPTCHA detected on login page');
  });

  it('throws when CAPTCHA detected after submit', async () => {
    let callCount = 0;
    vi.mocked(detectCaptcha).mockImplementation(async () => {
      callCount++;
      return callCount > 1; // false first time, true second time
    });
    const page = createMockPage();

    await expect(login(page, 'test@example.com', 'pass')).rejects.toThrow('CAPTCHA detected after login submit');
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
