import type { Browser, BrowserContext, Page } from 'playwright-core';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createChildLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { BROWSER_IDLE_TIMEOUT_MS } from '../../config/constants.js';
import { saveCookies } from './cookie-store.js';

const log = createChildLogger('session:browser-pool');

chromium.use(StealthPlugin());

interface PoolEntry {
  context: BrowserContext;
  page: Page;
  userId: string;
  lastActivityAt: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

let browser: Browser | null = null;
const pool = new Map<string, PoolEntry>();

async function ensureBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;

  log.info({ headless: env.HEADLESS, poolSize: env.BROWSER_POOL_SIZE }, 'Launching browser');
  browser = await chromium.launch({
    headless: env.HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  browser.on('disconnected', () => {
    log.warn('Browser disconnected');
    browser = null;
  });

  return browser;
}

function resetIdleTimer(entry: PoolEntry): void {
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => {
    log.info({ userId: entry.userId }, 'Idle timeout — evicting from pool');
    evictEntry(entry.userId).catch(err => {
      log.error({ userId: entry.userId, error: (err as Error).message }, 'Failed to evict on idle timeout');
    });
  }, BROWSER_IDLE_TIMEOUT_MS);
}

async function evictEntry(userId: string): Promise<void> {
  const entry = pool.get(userId);
  if (!entry) return;

  if (entry.idleTimer) clearTimeout(entry.idleTimer);

  try {
    const cookies = await entry.context.cookies();
    if (cookies.length > 0) {
      await saveCookies(userId, cookies);
    }
  } catch (err) {
    log.error({ userId, error: (err as Error).message }, 'Failed to persist cookies on eviction');
  }

  try {
    await entry.context.close();
  } catch {
    // Context may already be closed
  }

  pool.delete(userId);
  log.info({ userId, poolSize: pool.size }, 'Entry evicted');
}

export async function getPage(userId: string): Promise<Page> {
  // Return existing entry if available
  const existing = pool.get(userId);
  if (existing) {
    existing.lastActivityAt = Date.now();
    resetIdleTimer(existing);
    log.debug({ userId }, 'Returning existing page from pool');
    return existing.page;
  }

  // Check pool capacity
  if (pool.size >= env.BROWSER_POOL_SIZE) {
    // Evict least recently used entry
    let oldestUserId: string | null = null;
    let oldestTime = Infinity;
    for (const [uid, entry] of pool) {
      if (entry.lastActivityAt < oldestTime) {
        oldestTime = entry.lastActivityAt;
        oldestUserId = uid;
      }
    }
    if (oldestUserId) {
      log.info({ evictedUser: oldestUserId, requestingUser: userId }, 'Pool full — evicting LRU');
      await evictEntry(oldestUserId);
    }
  }

  // Create new entry
  const b = await ensureBrowser();
  const context = await b.newContext({
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const entry: PoolEntry = {
    context,
    page,
    userId,
    lastActivityAt: Date.now(),
    idleTimer: null,
  };
  pool.set(userId, entry);
  resetIdleTimer(entry);

  log.info({ userId, poolSize: pool.size }, 'New page created');
  return page;
}

export async function releasePage(userId: string): Promise<void> {
  const entry = pool.get(userId);
  if (!entry) {
    log.warn({ userId }, 'releasePage called but no entry in pool');
    return;
  }

  entry.lastActivityAt = Date.now();
  resetIdleTimer(entry);

  // Persist cookies on release
  try {
    const cookies = await entry.context.cookies();
    if (cookies.length > 0) {
      await saveCookies(userId, cookies);
    }
  } catch (err) {
    log.error({ userId, error: (err as Error).message }, 'Failed to persist cookies on release');
  }

  log.debug({ userId }, 'Page released back to pool');
}

export async function shutdown(): Promise<void> {
  log.info({ poolSize: pool.size }, 'Shutting down browser pool');

  // Persist all cookies and close all contexts
  const entries = [...pool.entries()];
  for (const [userId, entry] of entries) {
    await evictEntry(userId);
  }

  // Close browser
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Already closed
    }
    browser = null;
  }

  log.info('Browser pool shutdown complete');
}

export function getPoolSize(): number {
  return pool.size;
}

export function getPoolInfo() {
  return {
    browserConnected: browser?.isConnected() ?? false,
    maxSize: env.BROWSER_POOL_SIZE,
    currentSize: pool.size,
    entries: [...pool.entries()].map(([userId, entry]) => ({
      userId,
      lastActivityAt: new Date(entry.lastActivityAt).toISOString(),
    })),
  };
}
