import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectCaptcha, getCaptchaBreaker } from '../../src/modules/session/captcha-detector.js';

function createMockPage(url: string, selectors: Record<string, boolean> = {}) {
  return {
    url: () => url,
    $: vi.fn(async (selector: string) => selectors[selector] ? {} : null),
  } as any;
}

describe('captcha-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects CAPTCHA via URL pattern', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/captcha/verify');
    const result = await detectCaptcha(page);
    expect(result).toBe(true);
  });

  it('detects CAPTCHA via challenge URL', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/challenge?ref=login');
    const result = await detectCaptcha(page);
    expect(result).toBe(true);
  });

  it('detects CAPTCHA via DOM selector (recaptcha iframe)', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/meinkonto', {
      'iframe[src*="recaptcha"]': true,
    });
    const result = await detectCaptcha(page);
    expect(result).toBe(true);
  });

  it('detects CAPTCHA via DOM selector (hcaptcha)', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/login', {
      '.h-captcha': true,
    });
    const result = await detectCaptcha(page);
    expect(result).toBe(true);
  });

  it('returns false on normal page', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/meinkonto/dashboard');
    const result = await detectCaptcha(page);
    expect(result).toBe(false);
  });

  it('triggers circuit breaker on detection with userId', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/captcha/verify');
    await detectCaptcha(page, 'user-1');

    const breaker = getCaptchaBreaker('user-1');
    expect(breaker.isOpen()).toBe(true);
  });

  it('does not trigger circuit breaker without userId', async () => {
    const page = createMockPage('https://www.immobilienscout24.de/captcha/verify');
    await detectCaptcha(page);
    // No userId passed, so no breaker should be created/triggered
    // This just verifies it doesn't throw
  });
});
