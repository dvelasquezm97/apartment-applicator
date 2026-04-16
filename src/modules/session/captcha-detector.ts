import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { CircuitBreaker } from '../../lib/circuit-breaker.js';
import { CaptchaDetectedError } from '../../lib/errors.js';
import { CIRCUIT_BREAKER } from '../../config/constants.js';

const log = createChildLogger('session:captcha-detector');

const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  'iframe[src*="captcha"]',
  '#recaptcha',
  '.g-recaptcha',
  '.h-captcha',
  '[data-captcha]',
  // GeeTest (Immoscout uses this)
  '.geetest_panel',
  '.geetest_widget',
  'iframe[src*="geetest"]',
  '[class*="geetest"]',
  // Immoscout-specific bot detection page
  'text="Du bist ein Mensch aus Fleisch und Blut"',
  'text="löse bitte diesen kurzen Test"',
];

const CAPTCHA_URL_PATTERNS = [
  /captcha/i,
  /challenge/i,
  /verify.*human/i,
  /geetest/i,
];

// One circuit breaker per user, keyed by userId
const breakers = new Map<string, CircuitBreaker>();

function getBreaker(userId: string): CircuitBreaker {
  let breaker = breakers.get(userId);
  if (!breaker) {
    breaker = new CircuitBreaker(`captcha:${userId}`, CIRCUIT_BREAKER.CAPTCHA);
    breakers.set(userId, breaker);
  }
  return breaker;
}

export function getCaptchaBreaker(userId: string): CircuitBreaker {
  return getBreaker(userId);
}

export async function detectCaptcha(page: Page, userId?: string): Promise<boolean> {
  // Check URL patterns
  const url = page.url();
  for (const pattern of CAPTCHA_URL_PATTERNS) {
    if (pattern.test(url)) {
      log.warn({ userId, url }, 'CAPTCHA detected via URL pattern');
      if (userId) handleDetection(userId);
      return true;
    }
  }

  // Check DOM selectors
  for (const selector of CAPTCHA_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element) {
        log.warn({ userId, selector }, 'CAPTCHA detected via selector');
        if (userId) handleDetection(userId);
        return true;
      }
    } catch {
      // Invalid selector for this page — skip
    }
  }

  // Check page text for bot detection messages
  try {
    const bodyText = await page.textContent('body');
    if (bodyText && /löse bitte diesen kurzen Test|Mensch aus Fleisch und Blut/i.test(bodyText)) {
      log.warn({ userId }, 'CAPTCHA detected via bot detection page text');
      if (userId) handleDetection(userId);
      return true;
    }
  } catch {
    // Page may not have body accessible
  }

  return false;
}

function handleDetection(userId: string): void {
  const breaker = getBreaker(userId);
  breaker.recordFailure();
  log.error({ userId, breakerState: breaker.getInfo() }, 'CAPTCHA circuit breaker triggered');
}
