import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../src/modules/session/captcha-detector.js', () => ({
  detectCaptcha: vi.fn(),
}));

vi.mock('../../src/modules/auto-apply/human-delay.js', () => ({
  humanDelay: vi.fn(),
  humanClick: vi.fn(),
}));

vi.mock('../../src/config/constants.js', () => ({
  DELAYS: {
    BETWEEN_PAGES: { min: 0, max: 0 },
    BEFORE_CLICK: { min: 0, max: 0 },
  },
}));

vi.mock('../../src/modules/auto-apply/selectors.js', () => ({
  LISTING: {
    CONTENT: '#is24-content, .is24-content',
    REMOVED_INDICATORS: [
      '.status-message--removed',
      '.expose--deactivated',
      'h1:has-text("nicht mehr verfügbar")',
      'h1:has-text("Dieses Angebot ist nicht mehr")',
    ],
    APPLY_BUTTONS: [
      '[data-testid="contact-message-button"]',
      '[data-testid="contact-button"]',
    ],
  },
  FORM: {},
  RESULT: {},
}));

import { navigateToListing } from '../../src/modules/auto-apply/navigator.js';
import { detectCaptcha } from '../../src/modules/session/captcha-detector.js';
import { humanClick } from '../../src/modules/auto-apply/human-delay.js';

function createMockPage(overrides: Record<string, any> = {}) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(null),
    textContent: vi.fn().mockResolvedValue(''),
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/expose/12345'),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('navigateToListing', () => {
  it('returns success when apply button is found and clicked', async () => {
    const mockElement = { isVisible: vi.fn().mockResolvedValue(true) };
    const page = createMockPage({
      $: vi.fn().mockImplementation(async (selector: string) => {
        // Match new apply button selectors
        if (selector.includes('contact-message-button') || selector.includes('contact-button')) {
          return mockElement;
        }
        return null;
      }),
      textContent: vi.fn().mockResolvedValue('Schöne Wohnung in Berlin'),
    });
    (detectCaptcha as any).mockResolvedValue(false);
    (humanClick as any).mockResolvedValue(undefined);

    const result = await navigateToListing(page, 'https://example.com/expose/12345', 'user-1');

    expect(result.success).toBe(true);
    expect(result.listingRemoved).toBe(false);
    expect(result.captchaDetected).toBe(false);
    expect(page.goto).toHaveBeenCalledWith('https://example.com/expose/12345', expect.any(Object));
  });

  it('detects CAPTCHA and returns captchaDetected', async () => {
    const page = createMockPage({
      textContent: vi.fn().mockResolvedValue(''),
    });
    (detectCaptcha as any).mockResolvedValue(true);

    const result = await navigateToListing(page, 'https://example.com/expose/12345', 'user-1');

    expect(result.success).toBe(false);
    expect(result.captchaDetected).toBe(true);
  });

  it('detects listing removed via body text', async () => {
    const page = createMockPage({
      textContent: vi.fn().mockResolvedValue('Dieses Angebot ist nicht mehr verfügbar'),
    });
    (detectCaptcha as any).mockResolvedValue(false);

    const result = await navigateToListing(page, 'https://example.com/expose/12345', 'user-1');

    expect(result.success).toBe(false);
    expect(result.listingRemoved).toBe(true);
  });

  it('detects listing removed via CSS selector', async () => {
    const page = createMockPage({
      $: vi.fn().mockImplementation(async (sel: string) => {
        if (sel.includes('status-message--removed') || sel.includes('expose--deactivated')) {
          return { isVisible: vi.fn().mockResolvedValue(true) };
        }
        return null;
      }),
      textContent: vi.fn().mockResolvedValue(''),
    });
    (detectCaptcha as any).mockResolvedValue(false);

    const result = await navigateToListing(page, 'https://example.com/expose/12345', 'user-1');

    expect(result.success).toBe(false);
    expect(result.listingRemoved).toBe(true);
  });

  it('returns failure when apply button not found', async () => {
    const page = createMockPage({
      $: vi.fn().mockResolvedValue(null),
      textContent: vi.fn().mockResolvedValue('Normal listing page content'),
    });
    (detectCaptcha as any).mockResolvedValue(false);

    const result = await navigateToListing(page, 'https://example.com/expose/12345', 'user-1');

    expect(result.success).toBe(false);
    expect(result.listingRemoved).toBe(false);
    expect(result.captchaDetected).toBe(false);
  });
});
