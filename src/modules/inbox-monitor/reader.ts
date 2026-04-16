import type { Page } from 'playwright-core';
import type { InboxMessage } from '../../types/message.js';
import { createChildLogger } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { humanDelay } from '../auto-apply/human-delay.js';
import { DELAYS } from '../../config/constants.js';
import { detectCaptcha } from '../session/captcha-detector.js';
import { CaptchaDetectedError } from '../../lib/errors.js';
import { INBOX, MESSAGE_VIEW } from './selectors.js';

const log = createChildLogger('inbox-monitor:reader');

const INBOX_URL = 'https://www.immobilienscout24.de/nachrichten/';

interface ThreadInfo {
  title: string;
  listingUrl: string | null;
  immoscoutId: string | null;
  index: number;
  itemSelector: string;
}

/**
 * Navigate to the Immoscout24 inbox and extract all unprocessed inbound messages.
 * Matches threads to existing applications via listing URL / immoscout_id.
 *
 * Re-scrapes the thread list after each goBack() to avoid stale element handles.
 */
export async function readNewMessages(page: Page, userId: string): Promise<InboxMessage[]> {
  log.info({ userId }, 'Reading inbox');

  await page.goto(INBOX_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await humanDelay(page, DELAYS.BETWEEN_PAGES);

  // Check for CAPTCHA
  const captcha = await detectCaptcha(page, userId);
  if (captcha) {
    throw new CaptchaDetectedError(userId);
  }

  // Scrape thread metadata (without storing element handles)
  const threadInfos = await scrapeThreadInfos(page);
  if (threadInfos.length === 0) {
    log.info({ userId }, 'No threads found in inbox');
    return [];
  }

  log.info({ userId, threadCount: threadInfos.length }, 'Found threads in inbox');

  const messages: InboxMessage[] = [];

  for (const threadInfo of threadInfos) {
    // Match thread to an application
    const applicationId = await matchThreadToApplication(threadInfo, userId);
    if (!applicationId) {
      log.debug({ title: threadInfo.title }, 'Thread does not match any application — skipping');
      continue;
    }

    // Re-query the thread element fresh by matching listing link (not by index,
    // which can shift when opening a thread marks it as read and reorders the list)
    try {
      const threadEl = await findThreadByImmoscoutId(page, threadInfo);
      if (!threadEl) {
        log.warn({ title: threadInfo.title, immoscoutId: threadInfo.immoscoutId }, 'Thread element not found after re-query');
        continue;
      }

      await threadEl.click();
      await humanDelay(page, DELAYS.BETWEEN_PAGES);

      const threadMessages = await extractMessages(page, applicationId);

      // Filter to only unprocessed messages
      const unprocessed = await filterUnprocessed(threadMessages, applicationId);
      messages.push(...unprocessed);

      // Navigate back to inbox list and wait for it to reload
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await humanDelay(page, { min: 1000, max: 2000 });
    } catch (err) {
      log.warn({ title: threadInfo.title, error: (err as Error).message }, 'Failed to read thread');
      // Try to get back to the inbox for the next iteration
      try { await page.goto(INBOX_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 }); } catch { /* best effort */ }
    }
  }

  log.info({ userId, newMessages: messages.length }, 'Inbox scan complete');
  return messages;
}

/**
 * Scrape thread metadata from the inbox page.
 * Stores index + selector rather than element handles, so we can re-query
 * fresh elements after navigating back from a conversation view.
 */
async function scrapeThreadInfos(page: Page): Promise<ThreadInfo[]> {
  const threads: ThreadInfo[] = [];

  for (const itemSelector of INBOX.THREAD_ITEM) {
    const items = await page.$$(itemSelector);
    if (items.length === 0) continue;

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const title = await item.$(INBOX.THREAD_TITLE)
        .then(el => el?.textContent())
        .then(t => t?.trim() || '') ?? '';

      // Extract listing URL from thread (to match to application)
      const listingLink = await item.$(INBOX.THREAD_LISTING_LINK);
      const listingUrl = listingLink ? await listingLink.getAttribute('href') : null;

      // Extract immoscout_id from listing URL
      const immoscoutId = listingUrl ? extractImmoscoutId(listingUrl) : null;

      threads.push({ title, listingUrl, immoscoutId, index: i, itemSelector });
    }

    break; // Found threads with this selector, stop trying others
  }

  return threads;
}

/**
 * Extract individual messages from a conversation thread view.
 */
async function extractMessages(page: Page, applicationId: string): Promise<InboxMessage[]> {
  const messages: InboxMessage[] = [];

  for (const itemSelector of MESSAGE_VIEW.MESSAGE_ITEM) {
    const items = await page.$$(itemSelector);
    if (items.length === 0) continue;

    for (const item of items) {
      const body = await item.$(MESSAGE_VIEW.MESSAGE_BODY)
        .then(el => el?.textContent())
        .then(t => t?.trim() || '') ?? '';

      if (!body) continue;

      // Parse timestamp safely — prefer datetime attribute, fallback to now
      const dateEl = await item.$(MESSAGE_VIEW.MESSAGE_DATE);
      const receivedAt = await parseDateSafe(dateEl);

      // Determine direction: check if the element itself or a descendant has a "sent" class.
      // Use evaluate() to check the element's own classes (item.$() only checks descendants).
      const isSent = await item.evaluate((el: Element) => {
        const sentPatterns = ['--sent', '--outbound', '--mine', 'message-sent'];
        const classes = el.className || '';
        if (sentPatterns.some(p => classes.includes(p))) return true;
        // Also check descendants
        return !!el.querySelector(
          '.message-thread__message--sent, [data-qa="message-sent"], .message--outbound, .message--mine'
        );
      });
      const direction = isSent ? 'OUTBOUND' as const : 'INBOUND' as const;

      // Only collect inbound messages for classification
      if (direction === 'INBOUND') {
        messages.push({
          id: crypto.randomUUID(),
          applicationId,
          direction,
          content: body,
          receivedAt,
          processedAt: null,
        });
      }
    }

    break; // Found messages with this selector
  }

  return messages;
}

/**
 * Safely parse a date from a message element.
 * Prefers the `datetime` attribute (ISO format). Falls back to attempting to parse
 * localized German dates. If all else fails, returns the current time.
 */
async function parseDateSafe(dateEl: any): Promise<string> {
  if (!dateEl) return new Date().toISOString();

  // Prefer datetime attribute (usually ISO format)
  const datetimeAttr = await dateEl.getAttribute('datetime').catch(() => null);
  if (datetimeAttr) {
    const d = new Date(datetimeAttr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Try text content
  const dateText = await dateEl.textContent().catch(() => null);
  if (!dateText) return new Date().toISOString();

  const trimmed = dateText.trim();

  // Try ISO parse first
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) return isoDate.toISOString();

  // Try German date format: "15.04.2026" or "15.04.2026, 14:00"
  const germanMatch = trimmed.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?/);
  if (germanMatch) {
    const [, day, month, year, hours, minutes] = germanMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hours || 0), Number(minutes || 0));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Fallback: current time
  log.debug({ dateText: trimmed }, 'Could not parse date — using current time');
  return new Date().toISOString();
}

/**
 * Match a thread to an existing application via immoscout_id.
 */
async function matchThreadToApplication(thread: ThreadInfo, userId: string): Promise<string | null> {
  if (!thread.immoscoutId) return null;

  // Find listing by immoscout_id
  const { data: listing } = await supabaseAdmin
    .from('bk_listings')
    .select('id')
    .eq('immoscout_id', thread.immoscoutId)
    .single();

  if (!listing) return null;

  // Find application for this user + listing
  const { data: application } = await supabaseAdmin
    .from('bk_applications')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listing.id)
    .single();

  return application?.id || null;
}

/**
 * Filter out messages that have already been successfully processed.
 * Only filters against messages with processed_at IS NOT NULL — messages left
 * unprocessed (from failed routing) are intentionally re-processed on the next scan.
 * Deduplicates by content + received_at so that legitimately repeated messages
 * (same landlord text at different times) are each processed.
 * The received_at comparison uses the DB-stored value (set once on first insert)
 * rather than the scraped timestamp, which may vary between scans for relative dates.
 */
async function filterUnprocessed(messages: InboxMessage[], applicationId: string): Promise<InboxMessage[]> {
  if (messages.length === 0) return [];

  // Only filter against successfully processed messages
  const { data: existing } = await supabaseAdmin
    .from('bk_messages')
    .select('content, received_at')
    .eq('application_id', applicationId)
    .eq('direction', 'INBOUND')
    .not('processed_at', 'is', null);

  // Use content + truncated date (to the minute) as dedup key.
  // This handles the case where the same text is sent at different times.
  const existingSet = new Set(
    (existing || []).map((m: any) => `${m.content}|${truncateToMinute(m.received_at)}`),
  );

  return messages.filter(m => !existingSet.has(`${m.content}|${truncateToMinute(m.receivedAt)}`));
}

/** Truncate an ISO timestamp to the minute for fuzzy dedup comparison. */
function truncateToMinute(iso: string): string {
  try {
    return iso.slice(0, 16); // "2026-04-15T14:30"
  } catch {
    return iso;
  }
}

/**
 * Re-find a thread element by matching its listing link's immoscout_id.
 * Falls back to index-based lookup if the thread has no immoscout_id.
 */
async function findThreadByImmoscoutId(page: Page, threadInfo: ThreadInfo) {
  const items = await page.$$(threadInfo.itemSelector);

  if (!threadInfo.immoscoutId) return null;

  for (const item of items) {
    const link = await item.$(INBOX.THREAD_LISTING_LINK);
    if (!link) continue;
    const href = await link.getAttribute('href');
    if (href && extractImmoscoutId(href) === threadInfo.immoscoutId) {
      return item;
    }
  }

  // No match found — don't fall back to stale index
  return null;
}

/**
 * Extract immoscout_id from a listing URL.
 * e.g., "https://www.immobilienscout24.de/expose/123456789" → "123456789"
 */
function extractImmoscoutId(url: string): string | null {
  const match = url.match(/\/expose\/(\d+)/);
  return match ? match[1]! : null;
}
