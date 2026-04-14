import { supabaseAdmin } from '../../lib/supabase.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('listing-monitor:dedup');

export async function isDuplicate(immoscoutId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('id')
    .eq('immoscout_id', immoscoutId)
    .limit(1);

  if (error) {
    log.error({ immoscoutId, error: error.message }, 'Failed to check duplicate');
    throw new Error(`Dedup check failed: ${error.message}`);
  }

  const exists = data !== null && data.length > 0;
  if (exists) {
    log.debug({ immoscoutId }, 'Listing already exists — skipping');
  }
  return exists;
}

export async function hasExistingApplication(userId: string, immoscoutId: string): Promise<boolean> {
  // Step 1: find the listing by immoscout_id
  const { data: listings } = await supabaseAdmin
    .from('listings')
    .select('id')
    .eq('immoscout_id', immoscoutId)
    .limit(1);

  if (!listings || listings.length === 0) return false;

  // Step 2: check if this user has an application for that listing
  const { data: apps } = await supabaseAdmin
    .from('applications')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listings[0]!.id)
    .limit(1);

  return (apps?.length ?? 0) > 0;
}

export async function insertListing(listing: {
  immoscoutId: string;
  url: string;
  title: string;
  address: string | null;
  rent: number | null;
  size: number | null;
  rooms: number | null;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('listings')
    .insert({
      immoscout_id: listing.immoscoutId,
      url: listing.url,
      title: listing.title,
      address: listing.address,
      rent: listing.rent,
      size: listing.size,
      rooms: listing.rooms,
      discovered_at: new Date().toISOString(),
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    log.error({ immoscoutId: listing.immoscoutId, error: error.message }, 'Failed to insert listing');
    throw new Error(`Insert listing failed: ${error.message}`);
  }

  log.info({ immoscoutId: listing.immoscoutId, id: data.id }, 'New listing inserted');
  return data.id;
}
