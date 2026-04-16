import { createChildLogger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { env } from '../config/env.js';
import {
  sendToExtension,
  broadcastToDashboard,
  waitForExtensionEvent,
  isExtensionConnected,
} from '../api/ws.js';
import type {
  ApplyProfile,
  ListingsScrapedEvent,
  NavigatedEvent,
  ApplySuccessEvent,
  ApplyFailedEvent,
  ProgressUpdate,
  ScrapedListingResult,
} from './types.js';

const log = createChildLogger('orchestrator:apply-loop');

/** Minimum delay between applications (ms). */
const MIN_DELAY_MS = 30_000;
/** Maximum delay between applications (ms). */
const MAX_DELAY_MS = 60_000;
/** Timeout for navigation events (ms). */
const NAVIGATE_TIMEOUT_MS = 30_000;
/** Timeout for scrape events (ms). */
const SCRAPE_TIMEOUT_MS = 60_000;
/** Timeout for a single apply operation (ms). */
const APPLY_TIMEOUT_MS = 120_000;
/** Maximum pages to scrape before stopping pagination. */
const MAX_PAGES = 20;

/**
 * The ApplyLoop orchestrator coordinates the Chrome extension to
 * automatically apply to apartment listings on Immoscout24.
 *
 * Flow:
 * 1. Fetch user search_url and profile from Supabase
 * 2. Send `navigate` command to extension with search URL
 * 3. Send `scrape-listings` command, receive listings
 * 4. Handle pagination (click-next-page, scrape again)
 * 5. Filter out already-applied listings
 * 6. For each unapplied listing: send `apply-to-listing`, wait for result
 * 7. Send progress updates to dashboard after each listing
 * 8. Respect daily cap and human-like delays
 * 9. Can be stopped mid-loop via stop()
 */
export class ApplyLoop {
  private userId: string;
  private running = false;
  private stopRequested = false;
  private progress: ProgressUpdate = {
    type: 'progress',
    status: 'idle',
    applied: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    currentListing: null,
  };

  constructor(userId: string) {
    this.userId = userId;
  }

  /** Start the apply loop. Resolves when the loop finishes or is stopped. */
  async start(): Promise<void> {
    if (this.running) {
      log.warn({ userId: this.userId }, 'Apply loop already running');
      return;
    }

    this.running = true;
    this.stopRequested = false;
    this.resetProgress();
    log.info({ userId: this.userId }, 'Apply loop started');

    try {
      await this.run();
    } catch (err) {
      log.error({ userId: this.userId, error: (err as Error).message }, 'Apply loop error');
      this.progress.status = 'idle';
      this.broadcastProgress();
    } finally {
      this.running = false;
      this.progress.status = 'done';
      this.progress.currentListing = null;
      this.broadcastProgress();
      log.info(
        { userId: this.userId, applied: this.progress.applied, failed: this.progress.failed },
        'Apply loop finished',
      );
    }
  }

  /** Request the loop to stop after the current listing finishes. */
  stop(): void {
    if (!this.running) return;
    log.info({ userId: this.userId }, 'Stop requested');
    this.stopRequested = true;
    sendToExtension(this.userId, { type: 'stop' });
  }

  /** Get current progress snapshot. */
  getStatus(): ProgressUpdate {
    return { ...this.progress };
  }

  // --- Private implementation ---

  private async run(): Promise<void> {
    // 1. Verify extension is connected
    if (!isExtensionConnected(this.userId)) {
      throw new Error('Chrome extension is not connected');
    }

    // 2. Fetch user data from Supabase
    const userData = await this.fetchUserData();
    if (!userData.searchUrl) {
      throw new Error('No search URL configured. Set a search URL in settings.');
    }
    if (!userData.profile || !userData.profile.name) {
      throw new Error('User profile is incomplete. Fill in your profile before applying.');
    }

    // 3. Check daily cap
    const remainingToday = await this.getRemainingDailyCap();
    if (remainingToday <= 0) {
      log.info({ userId: this.userId }, 'Daily application cap reached');
      return;
    }

    // 4. Navigate to search URL
    this.progress.status = 'scraping';
    this.broadcastProgress();

    sendToExtension(this.userId, { type: 'navigate', url: userData.searchUrl });
    await waitForExtensionEvent<NavigatedEvent>(this.userId, 'navigated', NAVIGATE_TIMEOUT_MS);

    // 5. Scrape listings across pages
    const allListings: ScrapedListingResult[] = [];
    let pageNum = 1;
    let hasNextPage = true;

    while (hasNextPage && pageNum <= MAX_PAGES && !this.stopRequested) {
      sendToExtension(this.userId, { type: 'scrape-listings', pageNum });
      const scraped = await waitForExtensionEvent<ListingsScrapedEvent>(
        this.userId,
        'listings-scraped',
        SCRAPE_TIMEOUT_MS,
      );

      allListings.push(...scraped.listings);
      hasNextPage = scraped.hasNextPage;

      if (hasNextPage && pageNum < MAX_PAGES && !this.stopRequested) {
        sendToExtension(this.userId, { type: 'click-next-page' });
        await waitForExtensionEvent<NavigatedEvent>(this.userId, 'navigated', NAVIGATE_TIMEOUT_MS);
        pageNum++;
      } else {
        break;
      }
    }

    log.info({ userId: this.userId, totalScraped: allListings.length, pages: pageNum }, 'Scraping complete');

    // 6. Filter out already-applied listings
    const alreadyAppliedIds = await this.getAlreadyAppliedListingIds(
      allListings.map((l) => l.id),
    );
    const unapplied = allListings.filter(
      (l) => !l.alreadyApplied && !alreadyAppliedIds.has(l.id),
    );

    this.progress.total = unapplied.length;
    this.progress.skipped = allListings.length - unapplied.length;
    this.broadcastProgress();

    log.info(
      { userId: this.userId, unapplied: unapplied.length, skipped: this.progress.skipped },
      'Filtered listings',
    );

    // 7. Apply to each unapplied listing
    this.progress.status = 'applying';
    let appliedThisRun = 0;
    const cap = Math.min(unapplied.length, remainingToday);

    for (let i = 0; i < cap; i++) {
      if (this.stopRequested || !isExtensionConnected(this.userId)) {
        log.info({ userId: this.userId }, 'Stopped — user request or extension disconnected');
        break;
      }

      const listing = unapplied[i]!;
      this.progress.currentListing = listing.title;
      this.broadcastProgress();

      const success = await this.applyToSingleListing(listing, userData.profile);

      if (success) {
        this.progress.applied++;
        appliedThisRun++;
        this.broadcastListingResult(listing, 'success');
      } else {
        this.progress.failed++;
        this.broadcastListingResult(listing, 'failed');
      }

      this.broadcastProgress();

      // Increment daily count in database
      await this.incrementDailyCount();

      // Human-like delay between applications (skip after last one)
      if (i < cap - 1 && !this.stopRequested) {
        await this.humanDelay();
      }
    }

    log.info(
      { userId: this.userId, appliedThisRun, totalApplied: this.progress.applied },
      'Apply phase complete',
    );
  }

  private async applyToSingleListing(
    listing: ScrapedListingResult,
    profile: ApplyProfile,
  ): Promise<boolean> {
    try {
      log.debug({ userId: this.userId, listingId: listing.id, title: listing.title }, 'Applying to listing');

      // Step 1: Navigate to the listing page first
      const listingUrl = `https://www.immobilienscout24.de/expose/${listing.id}`;
      sendToExtension(this.userId, { type: 'navigate', url: listingUrl });
      await waitForExtensionEvent<NavigatedEvent>(this.userId, 'navigated', NAVIGATE_TIMEOUT_MS);

      // Step 2: Check for CAPTCHA after navigation
      await this.waitForCaptchaIfNeeded();

      // Step 3: Send the apply command (now the page is loaded)
      sendToExtension(this.userId, {
        type: 'apply-to-listing',
        listingUrl,
        listingId: listing.id,
        profile,
      });

      // Step 4: Wait for either success, failure, or captcha
      const result = await Promise.race([
        waitForExtensionEvent<ApplySuccessEvent>(this.userId, 'apply-success', APPLY_TIMEOUT_MS),
        waitForExtensionEvent<ApplyFailedEvent>(this.userId, 'apply-failed', APPLY_TIMEOUT_MS),
        waitForExtensionEvent(this.userId, 'captcha-detected', APPLY_TIMEOUT_MS).then(() => {
          return { type: 'captcha-detected' as const } as any;
        }),
      ]);

      if (result.type === 'captcha-detected') {
        log.warn({ userId: this.userId, listingId: listing.id }, 'CAPTCHA during apply — waiting for user');
        await this.waitForCaptchaResolved();
        // Retry the apply after CAPTCHA is solved
        return this.applyToSingleListing(listing, profile);
      }

      if (result.type === 'apply-success') {
        log.info({ userId: this.userId, listingId: listing.id }, 'Application sent successfully');
        await this.recordApplication(listing, 'APPLIED');
        return true;
      } else {
        const failedEvent = result as ApplyFailedEvent;
        log.warn(
          { userId: this.userId, listingId: listing.id, reason: failedEvent.reason },
          'Application failed',
        );
        await this.recordApplication(listing, 'FAILED', failedEvent.reason);
        return false;
      }
    } catch (err) {
      log.error(
        { userId: this.userId, listingId: listing.id, error: (err as Error).message },
        'Apply attempt error',
      );
      await this.recordApplication(listing, 'FAILED', (err as Error).message).catch(() => {});
      return false;
    }
  }

  /**
   * Check if CAPTCHA is present on current page.
   * If detected, pause and wait for user to solve it (up to 5 minutes).
   */
  private async waitForCaptchaIfNeeded(): Promise<void> {
    sendToExtension(this.userId, { type: 'check-result' });
    // Quick check — if no captcha event within 3s, continue
    try {
      await waitForExtensionEvent(this.userId, 'captcha-detected', 3000);
      // CAPTCHA detected — wait for resolution
      log.warn({ userId: this.userId }, 'CAPTCHA detected — pausing for user to solve');
      this.progress.status = 'paused';
      this.broadcastProgress();
      await this.waitForCaptchaResolved();
      this.progress.status = 'applying';
      this.broadcastProgress();
    } catch {
      // No captcha event within 3s — page is clean, continue
    }
  }

  /**
   * Wait up to 5 minutes for the user to solve a CAPTCHA.
   */
  private async waitForCaptchaResolved(): Promise<void> {
    const maxWaitMs = 300_000; // 5 minutes
    try {
      await waitForExtensionEvent(this.userId, 'captcha-resolved', maxWaitMs);
      log.info({ userId: this.userId }, 'CAPTCHA resolved — continuing');
    } catch {
      throw new Error('CAPTCHA not resolved within 5 minutes — stopping');
    }
  }

  // --- Supabase data access ---

  private async fetchUserData(): Promise<{
    searchUrl: string | null;
    profile: ApplyProfile;
  }> {
    const { data, error } = await supabaseAdmin
      .from('bk_users')
      .select('search_url, profile')
      .eq('id', this.userId)
      .single();

    if (error || !data) {
      throw new Error('User not found in database');
    }

    const profile = (data.profile as Record<string, any>) || {};
    return {
      searchUrl: data.search_url as string | null,
      profile: {
        name: profile.name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        street: profile.street || '',
        houseNumber: profile.houseNumber || '',
        zipCode: profile.zipCode || '',
        city: profile.city || '',
        occupation: profile.occupation || '',
        income: profile.income || 0,
        message: profile.message,
      },
    };
  }

  private async getRemainingDailyCap(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('bk_users')
      .select('daily_application_count, daily_application_reset_at')
      .eq('id', this.userId)
      .single();

    if (error || !data) return 0;

    const resetAt = data.daily_application_reset_at
      ? new Date(data.daily_application_reset_at)
      : null;
    const now = new Date();

    // If reset_at is yesterday or earlier, the count should be reset
    if (!resetAt || resetAt.toDateString() !== now.toDateString()) {
      await supabaseAdmin
        .from('bk_users')
        .update({ daily_application_count: 0, daily_application_reset_at: now.toISOString() })
        .eq('id', this.userId);
      return env.DAILY_APPLICATION_CAP;
    }

    return Math.max(0, env.DAILY_APPLICATION_CAP - (data.daily_application_count || 0));
  }

  private async incrementDailyCount(): Promise<void> {
    // Read current count, then increment. A Supabase RPC would be better
    // for atomicity but this is sufficient for a single-user system.
    try {
      const { data } = await supabaseAdmin
        .from('bk_users')
        .select('daily_application_count')
        .eq('id', this.userId)
        .single();
      const current = (data?.daily_application_count as number) || 0;
      await supabaseAdmin
        .from('bk_users')
        .update({ daily_application_count: current + 1 })
        .eq('id', this.userId);
    } catch (err) {
      log.warn({ userId: this.userId, error: (err as Error).message }, 'Failed to increment daily count');
    }
  }

  private async getAlreadyAppliedListingIds(immoscoutIds: string[]): Promise<Set<string>> {
    if (immoscoutIds.length === 0) return new Set();

    // Look up listing UUIDs by immoscout_id, then check bk_applications
    const { data: listings } = await supabaseAdmin
      .from('bk_listings')
      .select('immoscout_id')
      .in('immoscout_id', immoscoutIds);

    if (!listings || listings.length === 0) return new Set();

    const { data: applications } = await supabaseAdmin
      .from('bk_applications')
      .select('listing_id, bk_listings!inner(immoscout_id)')
      .eq('user_id', this.userId)
      .in('bk_listings.immoscout_id', immoscoutIds);

    const appliedIds = new Set<string>();
    if (applications) {
      for (const app of applications as any[]) {
        const immoscoutId = app.bk_listings?.immoscout_id;
        if (immoscoutId) appliedIds.add(immoscoutId);
      }
    }
    return appliedIds;
  }

  private async recordApplication(
    listing: ScrapedListingResult,
    status: 'APPLIED' | 'FAILED',
    note?: string,
  ): Promise<void> {
    // Upsert listing first
    const { data: listingRow } = await supabaseAdmin
      .from('bk_listings')
      .upsert(
        {
          immoscout_id: listing.id,
          url: `https://www.immobilienscout24.de/expose/${listing.id}`,
          title: listing.title,
          address: listing.address,
          rent: listing.rent,
          size: listing.size,
          rooms: listing.rooms,
        },
        { onConflict: 'immoscout_id' },
      )
      .select('id')
      .single();

    if (!listingRow) {
      log.error({ listingId: listing.id }, 'Failed to upsert listing');
      return;
    }

    // Insert application record
    await supabaseAdmin.from('bk_applications').insert({
      user_id: this.userId,
      listing_id: listingRow.id,
      status,
      timeline: [
        {
          status,
          timestamp: new Date().toISOString(),
          note: note || (status === 'APPLIED' ? 'Applied via Chrome extension' : 'Failed'),
        },
      ],
    });
  }

  // --- Progress broadcasting ---

  private broadcastProgress(): void {
    broadcastToDashboard(this.userId, { ...this.progress });
  }

  private broadcastListingResult(
    listing: ScrapedListingResult,
    status: 'success' | 'failed' | 'skipped',
  ): void {
    broadcastToDashboard(this.userId, {
      type: 'listing-result',
      listingId: listing.id,
      title: listing.title,
      status,
    });
  }

  private resetProgress(): void {
    this.progress = {
      type: 'progress',
      status: 'idle',
      applied: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      currentListing: null,
    };
  }

  // --- Utilities ---

  /** Random delay between MIN_DELAY_MS and MAX_DELAY_MS to mimic human behavior. */
  private humanDelay(): Promise<void> {
    const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    log.debug({ userId: this.userId, delayMs: Math.round(ms) }, 'Human delay');
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
