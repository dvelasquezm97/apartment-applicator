import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { autoApplyQueue } from '../../lib/queue.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { getPage, releasePage } from '../session/index.js';
import { scrapeNewListings, type ScrapedListing } from './scraper.js';
import { isDuplicate, insertListing, hasExistingApplication } from './dedup.js';
import { canApply, incrementApplicationCount } from './filter.js';

const log = createChildLogger('listing-monitor');

export async function runListingMonitor(userId: string): Promise<{
  scraped: number;
  newListings: number;
  enqueued: number;
  skippedDuplicate: number;
  skippedCap: number;
}> {
  const stats = { scraped: 0, newListings: 0, enqueued: 0, skippedDuplicate: 0, skippedCap: 0 };

  let page: Page | null = null;
  try {
    // Get authenticated browser page from M1
    page = await getPage(userId);

    // Scrape saved searches
    const listings = await scrapeNewListings(page, userId);
    stats.scraped = listings.length;

    if (listings.length === 0) {
      log.info({ userId }, 'No listings found in this cycle');
      return stats;
    }

    // Process each listing: dedup → filter → insert → enqueue
    for (const listing of listings) {
      // Check if THIS USER already has an application for this listing
      if (await hasExistingApplication(userId, listing.immoscoutId)) {
        stats.skippedDuplicate++;
        continue;
      }

      // Check daily cap (check before EACH enqueue, not just at start)
      if (!(await canApply(userId))) {
        stats.skippedCap += listings.length - stats.newListings - stats.skippedDuplicate;
        log.info({ userId, skippedCap: stats.skippedCap }, 'Daily cap reached — stopping');
        break;
      }

      // Insert listing + create application + enqueue as one logical unit
      // If any step fails, clean up to avoid orphaned records
      let listingId: string | null = null;
      try {
        listingId = await insertListing(listing);
        stats.newListings++;

        // Create application record
        const { data: application, error: appError } = await supabaseAdmin
          .from('bk_applications')
          .insert({
            user_id: userId,
            listing_id: listingId,
            status: 'APPLYING',
            retry_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (appError || !application) {
          throw new Error(`Failed to create application: ${appError?.message}`);
        }

        // Enqueue auto-apply job (userId in jobId to avoid multi-user collision)
        await autoApplyQueue.add(
          `apply:${userId}:${listing.immoscoutId}`,
          {
            userId,
            listingId,
            applicationId: application.id,
          },
          { jobId: `apply-${userId}-${listing.immoscoutId}` },
        );

        await incrementApplicationCount(userId);
        stats.enqueued++;

        log.info({
          userId,
          immoscoutId: listing.immoscoutId,
          title: listing.title,
          applicationId: application.id,
        }, 'New listing enqueued for auto-apply');
      } catch (err) {
        // If listing was inserted but downstream failed, delete it so future cycles retry
        if (listingId) {
          await supabaseAdmin.from('bk_listings').delete().eq('id', listingId);
          stats.newListings--;
          log.warn({ listingId, immoscoutId: listing.immoscoutId }, 'Rolled back listing after downstream failure');
        }
        log.error({ immoscoutId: listing.immoscoutId, error: (err as Error).message }, 'Failed to process listing');
        continue;
      }
    }

    log.info({ userId, ...stats }, 'Listing monitor cycle complete');
    return stats;
  } finally {
    if (page) {
      await releasePage(userId);
    }
  }
}

// Re-export submodule functions
export { scrapeNewListings } from './scraper.js';
export { isDuplicate } from './dedup.js';
export { canApply, isBlackoutHour } from './filter.js';
