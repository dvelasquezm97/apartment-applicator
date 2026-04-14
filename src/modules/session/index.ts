import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { decrypt } from '../../lib/encryption.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CircuitBreakerOpenError } from '../../lib/errors.js';
import * as pool from './browser-pool.js';
import { saveCookies, loadCookies } from './cookie-store.js';
import { login, isLoggedIn } from './login.js';
import { detectCaptcha, getCaptchaBreaker } from './captcha-detector.js';

const log = createChildLogger('session');

export async function getPage(userId: string): Promise<Page> {
  // Check circuit breaker before doing anything
  const breaker = getCaptchaBreaker(userId);
  if (breaker.isOpen()) {
    throw new CircuitBreakerOpenError(userId, 'captcha');
  }

  const page = await pool.getPage(userId);

  // Try to restore cookies if this is a fresh context
  const cookies = await loadCookies(userId);
  if (cookies && cookies.length > 0) {
    await page.context().addCookies(cookies);
    log.info({ userId, cookieCount: cookies.length }, 'Cookies restored');

    // Navigate to check if session is valid
    await page.goto('https://www.immobilienscout24.de/meinkonto/dashboard', {
      waitUntil: 'domcontentloaded',
    });

    // Check for CAPTCHA
    if (await detectCaptcha(page, userId)) {
      throw new CircuitBreakerOpenError(userId, 'captcha');
    }

    // Check if cookies gave us a valid session
    if (await isLoggedIn(page)) {
      log.info({ userId }, 'Session restored from cookies');
      breaker.recordSuccess();
      return page;
    }

    log.info({ userId }, 'Cookies expired — falling back to login');
  }

  // Need to login
  const user = await getUser(userId);
  let password: string;
  try {
    password = decrypt(user.immoscout_password_encrypted);
  } catch (err) {
    log.error({ userId }, 'Failed to decrypt password — credentials may be corrupted');
    throw err;
  }
  await login(page, user.immoscout_email, password);

  // Save new cookies after successful login
  const newCookies = await page.context().cookies();
  await saveCookies(userId, newCookies);

  breaker.recordSuccess();
  log.info({ userId }, 'Login complete, cookies saved');
  return page;
}

export async function releasePage(userId: string): Promise<void> {
  await pool.releasePage(userId);
}

export async function shutdown(): Promise<void> {
  await pool.shutdown();
}

export async function isSessionHealthy(userId: string): Promise<boolean> {
  const breaker = getCaptchaBreaker(userId);
  if (breaker.isOpen()) return false;

  try {
    const cookies = await loadCookies(userId);
    return cookies !== null && cookies.length > 0;
  } catch {
    return false;
  }
}

async function getUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('immoscout_email, immoscout_password_encrypted')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`User ${userId} not found: ${error?.message}`);
  }

  return data as { immoscout_email: string; immoscout_password_encrypted: string };
}

// Re-export for convenience
export { getCaptchaBreaker } from './captcha-detector.js';
export { getPoolInfo } from './browser-pool.js';
