import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('../../src/modules/session/captcha-detector.js', () => ({
  detectCaptcha: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/modules/auto-apply/human-delay.js', () => ({
  humanDelay: vi.fn(),
}));

vi.mock('../../src/config/constants.js', () => ({
  DELAYS: {
    BETWEEN_PAGES: { min: 0, max: 0 },
  },
}));

import { readNewMessages } from '../../src/modules/inbox-monitor/reader.js';
import { detectCaptcha } from '../../src/modules/session/captcha-detector.js';
import { CaptchaDetectedError } from '../../src/lib/errors.js';

function createMockPage(options: { threads?: number; captcha?: boolean } = {}) {
  const { threads = 0, captcha = false } = options;

  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    goBack: vi.fn().mockResolvedValue(undefined),
    $$: vi.fn().mockResolvedValue([]),
    $: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockReturnValue('https://www.immobilienscout24.de/nachrichten/'),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readNewMessages', () => {
  it('returns empty array when no threads found', async () => {
    const page = createMockPage({ threads: 0 });
    (detectCaptcha as any).mockResolvedValue(false);

    const messages = await readNewMessages(page, 'user-1');

    expect(messages).toEqual([]);
    expect(page.goto).toHaveBeenCalledWith(
      'https://www.immobilienscout24.de/nachrichten/',
      expect.any(Object),
    );
  });

  it('throws CaptchaDetectedError when CAPTCHA found', async () => {
    const page = createMockPage();
    (detectCaptcha as any).mockResolvedValue(true);

    await expect(readNewMessages(page, 'user-1')).rejects.toThrow(CaptchaDetectedError);
  });

  it('navigates to inbox URL', async () => {
    const page = createMockPage();
    (detectCaptcha as any).mockResolvedValue(false);

    await readNewMessages(page, 'user-1');

    expect(page.goto).toHaveBeenCalledWith(
      'https://www.immobilienscout24.de/nachrichten/',
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    );
  });
});
