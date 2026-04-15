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
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  },
}));

vi.mock('../../src/modules/session/index.js', () => ({
  getPage: vi.fn(),
  releasePage: vi.fn(),
}));

vi.mock('../../src/modules/inbox-monitor/reader.js', () => ({
  readNewMessages: vi.fn(),
}));

vi.mock('../../src/modules/inbox-monitor/classifier.js', () => ({
  classifyMessage: vi.fn(),
}));

vi.mock('../../src/modules/inbox-monitor/router.js', () => ({
  routeMessage: vi.fn(),
}));

import { runInboxMonitor } from '../../src/modules/inbox-monitor/index.js';
import { getPage, releasePage } from '../../src/modules/session/index.js';
import { readNewMessages } from '../../src/modules/inbox-monitor/reader.js';
import { classifyMessage } from '../../src/modules/inbox-monitor/classifier.js';
import { routeMessage } from '../../src/modules/inbox-monitor/router.js';
import type { InboxMessage } from '../../src/types/message.js';

const mockPage = { waitForTimeout: vi.fn() } as any;

const sampleMessage: InboxMessage = {
  id: 'msg-1',
  applicationId: 'app-1',
  direction: 'INBOUND',
  content: 'Bitte senden Sie uns Ihre Unterlagen.',
  receivedAt: '2026-04-15T12:00:00Z',
  processedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (getPage as any).mockResolvedValue(mockPage);
  (releasePage as any).mockResolvedValue(undefined);
});

describe('runInboxMonitor (integration)', () => {
  it('runs full pipeline: read → classify → route', async () => {
    (readNewMessages as any).mockResolvedValue([sampleMessage]);
    (classifyMessage as any).mockResolvedValue({
      intent: 'DOCUMENT_REQUEST', confidence: 0.9, reasoning: 'Rule-based',
    });
    (routeMessage as any).mockResolvedValue(undefined);

    const result = await runInboxMonitor('user-1');

    expect(result.messagesRead).toBe(1);
    expect(result.classified['DOCUMENT_REQUEST']).toBe(1);
    expect(result.errors).toBe(0);
    expect(getPage).toHaveBeenCalledWith('user-1');
    expect(readNewMessages).toHaveBeenCalledWith(mockPage, 'user-1');
    expect(classifyMessage).toHaveBeenCalledWith(sampleMessage);
    expect(routeMessage).toHaveBeenCalled();
  });

  it('returns zero when no new messages', async () => {
    (readNewMessages as any).mockResolvedValue([]);

    const result = await runInboxMonitor('user-1');

    expect(result.messagesRead).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('always releases page even on error', async () => {
    (readNewMessages as any).mockRejectedValue(new Error('Network error'));

    await expect(runInboxMonitor('user-1')).rejects.toThrow('Network error');
    expect(releasePage).toHaveBeenCalledWith('user-1');
  });

  it('counts classification errors without failing the whole run', async () => {
    (readNewMessages as any).mockResolvedValue([sampleMessage, sampleMessage]);
    (classifyMessage as any)
      .mockResolvedValueOnce({ intent: 'GENERIC', confidence: 0.5, reasoning: 'test' })
      .mockRejectedValueOnce(new Error('API error'));
    (routeMessage as any).mockResolvedValue(undefined);

    const result = await runInboxMonitor('user-1');

    expect(result.messagesRead).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.classified['GENERIC']).toBe(1);
  });

  it('classifies multiple intents correctly', async () => {
    const docMsg = { ...sampleMessage, id: '1', content: 'Unterlagen bitte' };
    const viewMsg = { ...sampleMessage, id: '2', content: 'Besichtigung am Montag' };

    (readNewMessages as any).mockResolvedValue([docMsg, viewMsg]);
    (classifyMessage as any)
      .mockResolvedValueOnce({ intent: 'DOCUMENT_REQUEST', confidence: 0.9, reasoning: 'rules' })
      .mockResolvedValueOnce({ intent: 'VIEWING_INVITE', confidence: 0.85, reasoning: 'rules' });
    (routeMessage as any).mockResolvedValue(undefined);

    const result = await runInboxMonitor('user-1');

    expect(result.classified['DOCUMENT_REQUEST']).toBe(1);
    expect(result.classified['VIEWING_INVITE']).toBe(1);
  });
});
