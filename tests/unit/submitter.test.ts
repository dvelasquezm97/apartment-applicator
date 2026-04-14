import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed/doc.pdf' },
          error: null,
        }),
      }),
    },
  },
}));

vi.mock('../../src/modules/auto-apply/human-delay.js', () => ({
  humanClick: vi.fn(),
  humanDelay: vi.fn(),
  beforeSubmit: vi.fn(),
}));

vi.mock('../../src/config/constants.js', () => ({
  DELAYS: {
    BEFORE_CLICK: { min: 0, max: 0 },
    BEFORE_SUBMIT: { min: 0, max: 0 },
  },
}));

import { submitApplication } from '../../src/modules/auto-apply/submitter.js';
import { humanClick } from '../../src/modules/auto-apply/human-delay.js';

function createMockPage(options: {
  hasSubmitButton?: boolean;
  hasSuccess?: boolean;
  hasError?: boolean;
  hasAlreadyApplied?: boolean;
  errorText?: string;
} = {}) {
  const { hasSubmitButton = true, hasSuccess = false, hasError = false, hasAlreadyApplied = false, errorText = 'Fehler' } = options;

  return {
    $: vi.fn().mockImplementation(async (selector: string) => {
      // Submit button detection
      if (selector.includes('submit') || selector.includes('Senden') || selector.includes('Absenden')) {
        if (hasSubmitButton) {
          return { isVisible: vi.fn().mockResolvedValue(true), click: vi.fn() };
        }
        return null;
      }
      // Success detection
      if (selector.includes('success') || selector.includes('erfolgreich') || selector.includes('Vielen Dank')) {
        return hasSuccess ? {} : null;
      }
      // Already applied detection
      if (selector.includes('bereits') || selector.includes('already') || selector.includes('schon')) {
        return hasAlreadyApplied ? {} : null;
      }
      // Error detection
      if (selector.includes('error') || selector.includes('Fehler') || selector.includes('konnte nicht')) {
        if (hasError) return { textContent: vi.fn().mockResolvedValue(errorText) };
        return null;
      }
      return null;
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitApplication', () => {
  it('returns submitted=true on success', async () => {
    const page = createMockPage({ hasSubmitButton: true, hasSuccess: true });
    (humanClick as any).mockResolvedValue(undefined);

    const result = await submitApplication(page);

    expect(result.submitted).toBe(true);
    expect(result.alreadyApplied).toBe(false);
  });

  it('detects already-applied before submit', async () => {
    const page = createMockPage({ hasAlreadyApplied: true });

    const result = await submitApplication(page);

    expect(result.submitted).toBe(false);
    expect(result.alreadyApplied).toBe(true);
  });

  it('returns error when submit button not found', async () => {
    const page = createMockPage({ hasSubmitButton: false });

    const result = await submitApplication(page);

    expect(result.submitted).toBe(false);
    expect(result.error).toContain('Submit button not found');
  });

  it('detects form error after submission', async () => {
    const page = createMockPage({ hasSubmitButton: true, hasError: true, errorText: 'Senden fehlgeschlagen' });
    (humanClick as any).mockResolvedValue(undefined);

    const result = await submitApplication(page);

    expect(result.submitted).toBe(false);
    expect(result.error).toBe('Senden fehlgeschlagen');
  });

  it('assumes success when no explicit success or error detected', async () => {
    // No success, no error, no already-applied — conservative success
    const page = createMockPage({ hasSubmitButton: true });
    (humanClick as any).mockResolvedValue(undefined);

    const result = await submitApplication(page);

    expect(result.submitted).toBe(true);
  });
});
