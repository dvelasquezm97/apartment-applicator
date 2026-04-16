import type { Cookie } from 'playwright-core';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('session:cookie-store');

export async function saveCookies(userId: string, cookies: Cookie[]): Promise<void> {
  const json = JSON.stringify(cookies);
  const encrypted = encrypt(json);

  const { error } = await supabaseAdmin
    .from('bk_users')
    .update({ immoscout_cookies_encrypted: encrypted, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    log.error({ userId, error: error.message }, 'Failed to save cookies');
    throw new Error(`Failed to save cookies for user ${userId}: ${error.message}`);
  }

  log.info({ userId, cookieCount: cookies.length }, 'Cookies saved');
}

export async function loadCookies(userId: string): Promise<Cookie[] | null> {
  const { data, error } = await supabaseAdmin
    .from('bk_users')
    .select('immoscout_cookies_encrypted')
    .eq('id', userId)
    .single();

  if (error) {
    log.error({ userId, error: error.message }, 'Failed to load cookies');
    throw new Error(`Failed to load cookies for user ${userId}: ${error.message}`);
  }

  if (!data?.immoscout_cookies_encrypted) {
    log.info({ userId }, 'No saved cookies found');
    return null;
  }

  const json = decrypt(data.immoscout_cookies_encrypted);
  const cookies: Cookie[] = JSON.parse(json);
  log.info({ userId, cookieCount: cookies.length }, 'Cookies loaded');
  return cookies;
}
