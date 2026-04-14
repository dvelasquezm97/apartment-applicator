import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('listing-monitor:dedup');

// TODO: Check immoscout_id uniqueness against listings table

export async function isDuplicate(immoscoutId: string): Promise<boolean> {
  // TODO: Query Supabase for existing listing with this immoscout_id
  throw new Error('Not implemented');
}
