import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { DELAYS } from '../../config/constants.js';
import { detectCaptcha } from './captcha-detector.js';

const log = createChildLogger('session:login');

const IMMOSCOUT_LOGIN_URL = 'https://www.immobilienscout24.de/anbieter/login.html';

// Selectors — update here when Immoscout changes their login page
const SELECTORS = {
  emailInput: '#username',
  passwordInput: '#password',
  submitButton: '#submit',
  loggedInIndicator: '[data-testid="user-menu"], .user-menu, a[href*="meinkonto"]',
  loginError: '.alert-error, [data-testid="login-error"], .error-message',
};

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

export async function login(page: Page, email: string, password: string): Promise<void> {
  log.info('Navigating to Immoscout login page');
  try {
    await page.goto(IMMOSCOUT_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    throw new Error(`Failed to load login page: ${(err as Error).message}`);
  }
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  // Check for CAPTCHA before attempting login
  if (await detectCaptcha(page)) {
    throw new Error('CAPTCHA detected on login page');
  }

  // Fill email
  log.debug('Filling email field');
  await humanType(page, SELECTORS.emailInput, email);

  // Fill password
  await humanDelay(DELAYS.BETWEEN_FIELDS.min, DELAYS.BETWEEN_FIELDS.max);
  log.debug('Filling password field');
  await humanType(page, SELECTORS.passwordInput, password);

  // Submit
  await humanDelay(DELAYS.BEFORE_SUBMIT.min, DELAYS.BEFORE_SUBMIT.max);
  log.debug('Submitting login form');
  await page.click(SELECTORS.submitButton);

  // Wait for navigation
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch (err) {
    throw new Error(`Login page failed to load after submit: ${(err as Error).message}`);
  }
  await humanDelay(DELAYS.BETWEEN_PAGES.min, DELAYS.BETWEEN_PAGES.max);

  // Check for CAPTCHA after submit
  if (await detectCaptcha(page)) {
    throw new Error('CAPTCHA detected after login submit');
  }

  // Check for login error
  const errorEl = await page.$(SELECTORS.loginError);
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
    const indicator = await page.$(SELECTORS.loggedInIndicator);
    return indicator !== null;
  } catch {
    return false;
  }
}
