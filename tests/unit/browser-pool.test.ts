import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('playwright-extra', () => {
  const mockPage = {
    url: vi.fn().mockReturnValue('about:blank'),
    goto: vi.fn(),
    close: vi.fn(),
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    cookies: vi.fn().mockResolvedValue([]),
    addCookies: vi.fn(),
    close: vi.fn(),
  };
  const mockBrowser = {
    isConnected: vi.fn().mockReturnValue(true),
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn(),
    on: vi.fn(),
  };
  return {
    chromium: {
      use: vi.fn(),
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
    __mockBrowser: mockBrowser,
    __mockContext: mockContext,
    __mockPage: mockPage,
  };
});

vi.mock('puppeteer-extra-plugin-stealth', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/modules/session/cookie-store.js', () => ({
  saveCookies: vi.fn().mockResolvedValue(undefined),
  loadCookies: vi.fn().mockResolvedValue(null),
}));

import { getPage, releasePage, shutdown, getPoolSize, getPoolInfo } from '../../src/modules/session/browser-pool.js';
import { saveCookies } from '../../src/modules/session/cookie-store.js';

// Access mock internals
const { __mockBrowser: mockBrowser, __mockContext: mockContext } = await import('playwright-extra') as any;

describe('browser-pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser.isConnected.mockReturnValue(true);
    mockContext.cookies.mockResolvedValue([]);
  });

  afterEach(async () => {
    await shutdown();
  });

  it('creates a new page for a user', async () => {
    const page = await getPage('user-1');
    expect(page).toBeDefined();
    expect(getPoolSize()).toBe(1);
  });

  it('returns existing page for same user', async () => {
    const page1 = await getPage('user-1');
    const page2 = await getPage('user-1');
    expect(page1).toBe(page2);
    expect(getPoolSize()).toBe(1);
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(1);
  });

  it('creates separate contexts for different users', async () => {
    await getPage('user-1');
    await getPage('user-2');
    expect(getPoolSize()).toBe(2);
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
  });

  it('evicts LRU entry when pool is full', async () => {
    await getPage('user-1');
    await new Promise(r => setTimeout(r, 10));
    await getPage('user-2');
    await new Promise(r => setTimeout(r, 10));
    await getPage('user-3');

    expect(getPoolSize()).toBe(2);
    const info = getPoolInfo();
    const userIds = info.entries.map((e: any) => e.userId);
    expect(userIds).toContain('user-2');
    expect(userIds).toContain('user-3');
    expect(userIds).not.toContain('user-1');
  });

  it('persists cookies on releasePage', async () => {
    mockContext.cookies.mockResolvedValueOnce([{ name: 'test', value: '123' }]);

    await getPage('user-1');
    await releasePage('user-1');

    expect(saveCookies).toHaveBeenCalledWith('user-1', [{ name: 'test', value: '123' }]);
  });

  it('shutdown closes all contexts and browser', async () => {
    await getPage('user-1');
    await getPage('user-2');
    expect(getPoolSize()).toBe(2);

    await shutdown();

    expect(getPoolSize()).toBe(0);
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('getPoolInfo returns correct state', async () => {
    await getPage('user-1');

    const info = getPoolInfo();
    expect(info.browserConnected).toBe(true);
    expect(info.currentSize).toBe(1);
    expect(info.entries).toHaveLength(1);
    expect(info.entries[0].userId).toBe('user-1');
  });

  it('configures context with German locale and timezone', async () => {
    await getPage('user-1');

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
      }),
    );
  });
});
