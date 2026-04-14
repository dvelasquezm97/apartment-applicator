import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('session:cookie-store');

// TODO: Encrypt/decrypt cookies, persist to/from Supabase
// Uses AES-256-GCM via lib/encryption.ts
// Cookies stored in users.immoscout_cookies_encrypted

export async function saveCookies(userId: string, cookies: unknown[]): Promise<void> {
  // TODO: Serialize → encrypt → store in Supabase
  throw new Error('Not implemented');
}

export async function loadCookies(userId: string): Promise<unknown[] | null> {
  // TODO: Load from Supabase → decrypt → deserialize
  throw new Error('Not implemented');
}
