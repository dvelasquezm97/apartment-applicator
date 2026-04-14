import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { detectCaptcha } from '../session/captcha-detector.js';
import { LISTING } from './selectors.js';
import { humanDelay, humanClick } from './human-delay.js';
import { DELAYS } from '../../config/constants.js';

const log = createChildLogger('auto-apply:navigator');

export interface NavigationResult {
  success: boolean;
  listingRemoved: boolean;
  captchaDetected: boolean;
}

/**
 * Navigate to an Immoscout24 listing page, verify it's still available,
 * and click the apply/contact button to open the application form.
 *
 * Returns a NavigationResult indicating what happened.
 */
export async function navigateToListing(page: Page, url: string, userId: string): Promise<NavigationResult> {
  log.info({ url, userId }, 'Navigating to listing');

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await humanDelay(page, DELAYS.BETWEEN_PAGES);

  // Check for CAPTCHA
  const captcha = await detectCaptcha(page, userId);
  if (captcha) {
    log.warn({ url, userId }, 'CAPTCHA detected on listing page');
    return { success: false, listingRemoved: false, captchaDetected: true };
  }

  // Check if listing has been removed
  const removed = await isListingRemoved(page);
  if (removed) {
    log.info({ url, userId }, 'Listing is no longer available');
    return { success: false, listingRemoved: true, captchaDetected: false };
  }

  // Find and click the apply/contact button
  const clicked = await clickApplyButton(page);
  if (!clicked) {
    log.warn({ url, userId }, 'Apply button not found on listing page');
    return { success: false, listingRemoved: false, captchaDetected: false };
  }

  // Wait for the contact form to appear (may be inline or modal)
  await humanDelay(page, { min: 1000, max: 2000 });

  log.info({ url, userId }, 'Successfully navigated and opened application form');
  return { success: true, listingRemoved: false, captchaDetected: false };
}

/**
 * Check if the listing page shows a "no longer available" message.
 */
async function isListingRemoved(page: Page): Promise<boolean> {
  for (const selector of LISTING.REMOVED_INDICATORS) {
    const el = await page.$(selector);
    if (el) return true;
  }

  // Also check page content for common removal text
  const bodyText = await page.textContent('body');
  if (bodyText) {
    const lowerText = bodyText.toLowerCase();
    if (
      lowerText.includes('nicht mehr verfügbar') ||
      lowerText.includes('angebot wurde deaktiviert') ||
      lowerText.includes('expose existiert nicht')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Find and click the apply/contact button. Tries multiple selector variants.
 */
async function clickApplyButton(page: Page): Promise<boolean> {
  for (const selector of LISTING.APPLY_BUTTONS) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isVisible = await el.isVisible();
        if (isVisible) {
          await humanClick(page, selector);
          log.debug({ selector }, 'Clicked apply button');
          return true;
        }
      }
    } catch {
      // Selector didn't match or element not interactable, try next
    }
  }
  return false;
}
