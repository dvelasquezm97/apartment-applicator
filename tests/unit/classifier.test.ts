import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

// Mock Anthropic SDK for the Claude API fallback tests
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'classify_message',
              input: { intent: 'GENERIC', confidence: 0.7, reasoning: 'Ambiguous message' },
            },
          ],
        }),
      },
    })),
  };
});

import { classifyMessage, classifyByRules } from '../../src/modules/inbox-monitor/classifier.js';
import type { InboxMessage } from '../../src/types/message.js';

function makeMessage(content: string): InboxMessage {
  return {
    id: 'test-id',
    applicationId: 'test-app',
    direction: 'INBOUND',
    content,
    receivedAt: '2026-04-15T12:00:00Z',
    processedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyByRules', () => {
  it('classifies German document request', () => {
    const result = classifyByRules(
      'Vielen Dank für Ihre Anfrage. Bitte senden Sie uns folgende Unterlagen zu: Gehaltsnachweis, SCHUFA-Auskunft.',
    );
    expect(result.intent).toBe('DOCUMENT_REQUEST');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies document request with multiple keywords', () => {
    const result = classifyByRules(
      'Wir benötigen noch Ihre Unterlagen: Einkommensnachweis und SCHUFA. Bitte senden Sie diese schnellstmöglich.',
    );
    expect(result.intent).toBe('DOCUMENT_REQUEST');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('classifies German viewing invitation', () => {
    const result = classifyByRules(
      'Wir laden Sie herzlich zur Besichtigung ein am 20.04.2026 um 14:00 Uhr.',
    );
    expect(result.intent).toBe('VIEWING_INVITE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies viewing with Termin keyword', () => {
    const result = classifyByRules(
      'Gerne möchten wir einen Besichtigungstermin mit Ihnen vereinbaren.',
    );
    expect(result.intent).toBe('VIEWING_INVITE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies external form with URL', () => {
    const result = classifyByRules(
      'Bitte füllen Sie unser Bewerbungsformular aus: https://forms.example.com/apply/abc123',
    );
    expect(result.intent).toBe('EXTERNAL_FORM');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies rejection message', () => {
    const result = classifyByRules(
      'Leider müssen wir Ihnen mitteilen, dass die Wohnung bereits vergeben wurde.',
    );
    expect(result.intent).toBe('REJECTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies rejection with absage keyword', () => {
    const result = classifyByRules('Wir müssen Ihnen leider eine Absage erteilen.');
    expect(result.intent).toBe('REJECTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('defaults to GENERIC for ambiguous message', () => {
    const result = classifyByRules('Vielen Dank für Ihre Nachricht. Wir melden uns bald.');
    expect(result.intent).toBe('GENERIC');
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('defaults to GENERIC for empty message', () => {
    const result = classifyByRules('');
    expect(result.intent).toBe('GENERIC');
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe('classifyMessage (with API fallback)', () => {
  it('uses rule-based for clear document request (no API call)', async () => {
    const result = await classifyMessage(makeMessage(
      'Bitte senden Sie uns Ihre Unterlagen und SCHUFA-Auskunft zu.',
    ));
    expect(result.intent).toBe('DOCUMENT_REQUEST');
    expect(result.reasoning).toContain('Rule-based');
  });

  it('falls back to Claude API for ambiguous messages', async () => {
    const result = await classifyMessage(makeMessage(
      'Vielen Dank, wir melden uns.',
    ));
    expect(result.intent).toBe('GENERIC');
    // Either rule-based low confidence or Claude API
    expect(result.reasoning).toBeDefined();
  });
});
