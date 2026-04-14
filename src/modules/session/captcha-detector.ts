import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('session:captcha-detector');

// TODO: Detect CAPTCHA on page, trigger circuit breaker
// Check known selectors: recaptcha, hcaptcha, immoscout-specific
// On detection: screenshot → circuit breaker → Telegram alert

export async function detectCaptcha(page: Page): Promise<boolean> {
  // TODO: Check for CAPTCHA selectors and challenge page redirects
  throw new Error('Not implemented');
}
