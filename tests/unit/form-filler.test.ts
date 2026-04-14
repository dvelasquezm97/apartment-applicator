import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../src/modules/auto-apply/human-delay.js', () => ({
  humanType: vi.fn(),
  humanSelect: vi.fn(),
  clearAndType: vi.fn(),
  betweenFields: vi.fn(),
}));

vi.mock('../../src/config/constants.js', () => ({
  DELAYS: {
    TYPING_PER_CHAR: { min: 0, max: 0 },
    BETWEEN_FIELDS: { min: 0, max: 0 },
    BEFORE_CLICK: { min: 0, max: 0 },
  },
}));

import { fillApplicationForm } from '../../src/modules/auto-apply/form-filler.js';
import { clearAndType } from '../../src/modules/auto-apply/human-delay.js';
import type { UserProfile } from '../../src/types/session.js';

function createMockPage(visibleFields: string[] = []) {
  const mockElement = {
    isVisible: vi.fn().mockResolvedValue(true),
    inputValue: vi.fn().mockResolvedValue(''),
    evaluate: vi.fn().mockResolvedValue('input'),
  };
  const hiddenElement = {
    isVisible: vi.fn().mockResolvedValue(false),
    inputValue: vi.fn().mockResolvedValue(''),
    evaluate: vi.fn().mockResolvedValue('input'),
  };

  return {
    $: vi.fn().mockImplementation(async (selector: string) => {
      // Return visible element if selector matches any in the visibleFields list
      for (const field of visibleFields) {
        if (selector.includes(field)) return mockElement;
      }
      return null;
    }),
    waitForSelector: vi.fn().mockResolvedValue(mockElement),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    keyboard: { type: vi.fn().mockResolvedValue(undefined), press: vi.fn().mockResolvedValue(undefined) },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fillApplicationForm', () => {
  const fullProfile: UserProfile = {
    name: 'Max Mustermann',
    phone: '+491701234567',
    moveInDate: '01.06.2026',
    occupation: 'Softwareentwickler',
    employer: 'Aucto GmbH',
    income: 4500,
  };

  it('fills fields that exist on the form', async () => {
    const page = createMockPage(['firstName', 'vorname', 'lastName', 'nachname', 'phone', 'telefon', 'message', 'nachricht', 'contactForm']);

    const result = await fillApplicationForm(page, fullProfile);

    expect(result.fieldsFilled).toBeGreaterThan(0);
    expect(clearAndType).toHaveBeenCalled();
  });

  it('skips fields not found on the form', async () => {
    // Only form container exists, no individual fields
    const page = createMockPage(['contactForm']);

    const result = await fillApplicationForm(page, fullProfile);

    // Only message might match via the generic 'textarea' selector
    expect(result.fieldsSkipped.length).toBeGreaterThan(0);
  });

  it('handles empty profile gracefully', async () => {
    const page = createMockPage(['contactForm', 'message', 'nachricht']);
    const emptyProfile: UserProfile = {};

    const result = await fillApplicationForm(page, emptyProfile);

    // Should still attempt message field
    expect(result).toBeDefined();
    expect(result.fieldsFilled).toBeGreaterThanOrEqual(0);
  });

  it('returns zero fields when form container not found', async () => {
    const page = createMockPage([]); // No form container
    page.waitForSelector = vi.fn().mockRejectedValue(new Error('timeout'));

    const result = await fillApplicationForm(page, fullProfile);

    expect(result.fieldsFilled).toBe(0);
    expect(result.fieldsSkipped).toContain('form_container');
  });

  it('splits name into first and last name', async () => {
    const page = createMockPage(['firstName', 'vorname', 'lastName', 'nachname', 'contactForm']);

    await fillApplicationForm(page, { name: 'Anna Schmidt' });

    // clearAndType should be called with first name 'Anna' and last name 'Schmidt'
    const calls = (clearAndType as any).mock.calls;
    const textValues = calls.map((c: any[]) => c[2]);
    expect(textValues).toContain('Anna');
    expect(textValues).toContain('Schmidt');
  });

  it('composes German message from profile data', async () => {
    const page = createMockPage(['contactForm', 'message', 'nachricht']);

    await fillApplicationForm(page, fullProfile);

    const calls = (clearAndType as any).mock.calls;
    // Find the message call (longest text)
    const messageCalls = calls.filter((c: any[]) => typeof c[2] === 'string' && c[2].length > 50);
    expect(messageCalls.length).toBeGreaterThan(0);

    const messageText = messageCalls[0][2] as string;
    expect(messageText).toContain('Sehr geehrte');
    expect(messageText).toContain('Softwareentwickler');
    expect(messageText).toContain('Aucto GmbH');
    expect(messageText).toContain('4500');
    expect(messageText).toContain('Max Mustermann');
  });
});
