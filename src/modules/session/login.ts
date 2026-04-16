import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { DELAYS } from '../../config/constants.js';
import { detectCaptcha } from './captcha-detector.js';

const log = createChildLogger('session:login');

const IMMOSCOUT_LOGIN_URL = 'https://sso.immobilienscout24.de/sso/login?appName=is24main';

// Step 1: Email page
const STEP1_SELECTORS = {
  emailInput: '#username',
  submitButton: '#submit',
};

// Step 2: Password page
const STEP2_SELECTORS = {
  passwordInput: '#password',
  submitButton: '#submit',
};

// Cookie consent
const CONSENT_SELECTORS = {
  acceptAll: 'button:has-text("Alle akzeptieren"), [data-testid="consent-accept-all"], #consent-accept-all',
};

// Post-login indicators
const LOGGED_IN_SELECTORS = '[data-testid="user-menu"], .user-menu, a[href*="meinkonto"], a[href*="geschlossenerbereich"]';
const LOGIN_ERROR_SELECTORS = '.alert-error, [data-testid="login-error"], .error-message';

async function humanDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await humanDelay(DELAYS.BETWEEN_FIELDS.min, DELAYS.BETWEEN_FIELDS.max);
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: DELAYS.TYPING_PER_CHAR.min + Math.random() * (DELAYS.TYPING_PER_CHAR.max - DELAYS.TYPING_PER_CHAR.min),
    });
  }
}

async function dismissCookieConsent(page: Page): Promise<void> {
  try {
    const acceptBtn = await page.$(CONSENT_SELECTORS.acceptAll);
    if (acceptBtn) {
      log.info('Cookie consent popup detected — accepting');
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No consent popup — continue
  }
}

/**
 * Wait for user to solve CAPTCHA manually.
 * Polls every 2s for up to 2 minutes, checking if CAPTCHA is gone.
 */
async function waitForManualCaptchaSolve(page: Page): Promise<void> {
  const maxWaitMs = 120_000;
  const pollMs = 2_000;
  const start = Date.now();

  log.warn('CAPTCHA detected — waiting for manual solve (up to 2 minutes)...');

  while (Date.now() - start < maxWaitMs) {
    await page.waitForTimeout(pollMs);
    const stillCaptcha = await detectCaptcha(page);
    if (!stillCaptcha) {
      log.info('CAPTCHA solved — continuing');
      return;
    }
  }

  throw new Error('CAPTCHA not solved within 2 minutes');
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  log.info('Navigating to Immoscout SSO login page');
  try {
    await page.goto(IMMOSCOUT_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    throw new Error(`Failed to load login page: ${(err as Error).message}`);
  }
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  // Dismiss cookie consent if present
  await dismissCookieConsent(page);

  // Check for CAPTCHA before login
  if (await detectCaptcha(page)) {
    await waitForManualCaptchaSolve(page);
  }

  // --- Step 1: Enter email ---
  log.debug('Step 1: Filling email field');
  await page.waitForSelector(STEP1_SELECTORS.emailInput, { timeout: 10000 });
  await humanType(page, STEP1_SELECTORS.emailInput, email);

  await humanDelay(DELAYS.BEFORE_SUBMIT.min, DELAYS.BEFORE_SUBMIT.max);
  log.debug('Step 1: Submitting email');
  await page.click(STEP1_SELECTORS.submitButton);

  // Wait for step 2 to load
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  } catch {
    // May already be loaded
  }
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  // Check for CAPTCHA between steps
  if (await detectCaptcha(page)) {
    await waitForManualCaptchaSolve(page);
  }

  // Dismiss cookie consent again if it reappears
  await dismissCookieConsent(page);

  // --- Step 2: Enter password ---
  log.debug('Step 2: Waiting for password field');
  try {
    await page.waitForSelector(STEP2_SELECTORS.passwordInput, { timeout: 15000 });
  } catch {
    // Password field may not appear — could be a different flow
    log.error({ url: page.url() }, 'Password field not found after email submission');
    await page.screenshot({ path: '/tmp/bk-login-step2-fail.png' });
    throw new Error('Password field not found — login flow may have changed');
  }

  log.debug('Step 2: Filling password field');
  await humanType(page, STEP2_SELECTORS.passwordInput, password);

  await humanDelay(DELAYS.BEFORE_SUBMIT.min, DELAYS.BEFORE_SUBMIT.max);
  log.debug('Step 2: Submitting password');
  await page.click(STEP2_SELECTORS.submitButton);

  // Wait for navigation after login
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  } catch {
    // May already be loaded
  }
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  // Check for CAPTCHA after login submit
  if (await detectCaptcha(page)) {
    await waitForManualCaptchaSolve(page);
  }

  // Check for login error
  const errorEl = await page.$(LOGIN_ERROR_SELECTORS);
  if (errorEl) {
    const errorText = await errorEl.textContent();
    log.error({ errorText }, 'Login failed');
    throw new Error(`Login failed: ${errorText?.trim() || 'Unknown error'}`);
  }

  // Verify we're actually logged in
  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    log.error({ url: page.url() }, 'Login did not result in authenticated state');
    throw new Error('Login failed: not authenticated after submit');
  }

  log.info('Login successful');
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const indicator = await page.$(LOGGED_IN_SELECTORS);
    return indicator !== null;
  } catch {
    return false;
  }
}
