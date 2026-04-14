import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../src/lib/supabase.js', () => {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  return {
    supabaseAdmin: {
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
    },
  };
});

vi.mock('../../src/modules/session/index.js', () => ({
  getPage: vi.fn(),
  releasePage: vi.fn(),
}));

vi.mock('../../src/modules/auto-apply/navigator.js', () => ({
  navigateToListing: vi.fn(),
}));

vi.mock('../../src/modules/auto-apply/form-filler.js', () => ({
  fillApplicationForm: vi.fn(),
}));

vi.mock('../../src/modules/auto-apply/submitter.js', () => ({
  uploadDocuments: vi.fn(),
  submitApplication: vi.fn(),
}));

vi.mock('../../src/lib/state-machine.js', () => ({
  transition: vi.fn().mockReturnValue({
    newStatus: 'APPLIED',
    timelineEntry: { status: 'APPLIED', timestamp: '2026-04-15T00:00:00Z', note: 'test' },
    retryCount: 0,
  }),
}));

import { applyToListing } from '../../src/modules/auto-apply/index.js';
import { getPage, releasePage } from '../../src/modules/session/index.js';
import { navigateToListing } from '../../src/modules/auto-apply/navigator.js';
import { fillApplicationForm } from '../../src/modules/auto-apply/form-filler.js';
import { uploadDocuments, submitApplication } from '../../src/modules/auto-apply/submitter.js';
import { supabaseAdmin } from '../../src/lib/supabase.js';
import { CaptchaDetectedError } from '../../src/lib/errors.js';

const mockPage = {
  screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
  waitForTimeout: vi.fn(),
} as any;

beforeEach(() => {
  vi.clearAllMocks();

  // Default: getPage returns a mock page
  (getPage as any).mockResolvedValue(mockPage);
  (releasePage as any).mockResolvedValue(undefined);

  // Default: supabase returns valid listing
  (supabaseAdmin.from as any).mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { url: 'https://immobilienscout24.de/expose/12345', title: 'Nice flat', address: 'Berlin' },
          error: null,
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });
});

describe('applyToListing (integration)', () => {
  it('runs full pipeline: navigate → fill → submit → APPLIED', async () => {
    (navigateToListing as any).mockResolvedValue({
      success: true, listingRemoved: false, captchaDetected: false,
    });
    (fillApplicationForm as any).mockResolvedValue({
      fieldsFilled: 5, fieldsSkipped: [], messageFilled: true,
    });
    (uploadDocuments as any).mockResolvedValue(0);
    (submitApplication as any).mockResolvedValue({
      submitted: true, alreadyApplied: false, documentsUploaded: 0,
    });

    const result = await applyToListing('user-1', 'listing-1', 'app-1');

    expect(result.status).toBe('APPLIED');
    expect(result.fieldsFilled).toBe(5);
    expect(getPage).toHaveBeenCalledWith('user-1');
    expect(navigateToListing).toHaveBeenCalled();
    expect(fillApplicationForm).toHaveBeenCalled();
    expect(submitApplication).toHaveBeenCalled();
  });

  it('always releases page even on error', async () => {
    (navigateToListing as any).mockRejectedValue(new Error('Network timeout'));

    const result = await applyToListing('user-1', 'listing-1', 'app-1');

    expect(result.status).toBe('FAILED');
    expect(releasePage).toHaveBeenCalledWith('user-1');
  });

  it('returns LISTING_REMOVED when listing is delisted', async () => {
    (navigateToListing as any).mockResolvedValue({
      success: false, listingRemoved: true, captchaDetected: false,
    });

    const result = await applyToListing('user-1', 'listing-1', 'app-1');

    expect(result.status).toBe('LISTING_REMOVED');
  });

  it('throws CaptchaDetectedError on CAPTCHA', async () => {
    (navigateToListing as any).mockResolvedValue({
      success: false, listingRemoved: false, captchaDetected: true,
    });

    await expect(applyToListing('user-1', 'listing-1', 'app-1'))
      .rejects.toThrow(CaptchaDetectedError);
    expect(releasePage).toHaveBeenCalledWith('user-1');
  });

  it('handles already-applied as ALREADY_APPLIED (not FAILED)', async () => {
    (navigateToListing as any).mockResolvedValue({
      success: true, listingRemoved: false, captchaDetected: false,
    });
    (fillApplicationForm as any).mockResolvedValue({
      fieldsFilled: 3, fieldsSkipped: [], messageFilled: true,
    });
    (uploadDocuments as any).mockResolvedValue(0);
    (submitApplication as any).mockResolvedValue({
      submitted: false, alreadyApplied: true, documentsUploaded: 0,
    });

    const result = await applyToListing('user-1', 'listing-1', 'app-1');

    expect(result.status).toBe('ALREADY_APPLIED');
  });

  it('returns FAILED when navigation fails (no apply button)', async () => {
    (navigateToListing as any).mockResolvedValue({
      success: false, listingRemoved: false, captchaDetected: false,
    });

    const result = await applyToListing('user-1', 'listing-1', 'app-1');

    expect(result.status).toBe('FAILED');
  });

  it('returns FAILED when form submission fails', async () => {
    (navigateToListing as any).mockResolvedValue({
      success: true, listingRemoved: false, captchaDetected: false,
    });
    (fillApplicationForm as any).mockResolvedValue({
      fieldsFilled: 2, fieldsSkipped: ['income'], messageFilled: true,
    });
    (uploadDocuments as any).mockResolvedValue(0);
    (submitApplication as any).mockResolvedValue({
      submitted: false, alreadyApplied: false, documentsUploaded: 0, error: 'Submit button not found',
    });

    const result = await applyToListing('user-1', 'listing-1', 'app-1');

    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('Submit button not found');
  });
});
