import type { Page } from 'playwright-core';
import { DELAYS, JITTER_FACTOR } from '../../config/constants.js';

/**
 * Apply ±JITTER_FACTOR randomisation to a value.
 */
function jitter(value: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * JITTER_FACTOR;
  return Math.round(value * factor);
}

/**
 * Random delay within a min/max range (with jitter applied to the midpoint).
 */
export async function humanDelay(page: Page, range: { min: number; max: number }): Promise<void> {
  const base = range.min + Math.random() * (range.max - range.min);
  await page.waitForTimeout(jitter(base));
}

/**
 * Type text character by character with human-like speed variation.
 * Occasionally pauses mid-word to simulate natural typing rhythm.
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await humanDelay(page, { min: 100, max: 300 });

  for (let i = 0; i < text.length; i++) {
    const charDelay = DELAYS.TYPING_PER_CHAR.min + Math.random() * (DELAYS.TYPING_PER_CHAR.max - DELAYS.TYPING_PER_CHAR.min);

    // Occasional longer pause (simulate thinking) every 8-15 chars
    const pauseInterval = 8 + Math.floor(Math.random() * 8);
    if (i > 0 && i % pauseInterval === 0) {
      await page.waitForTimeout(jitter(300 + Math.random() * 500));
    }

    await page.keyboard.type(text[i]!, { delay: jitter(charDelay) });
  }
}

/**
 * Click an element with a human-like pre-click delay and scroll-into-view.
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.waitForSelector(selector, { timeout: 10_000 });
  if (!element) throw new Error(`Element not found: ${selector}`);

  await element.scrollIntoViewIfNeeded();
  await humanDelay(page, DELAYS.BEFORE_CLICK);
  await element.click();
}

/**
 * Select a dropdown option with human-like delay.
 */
export async function humanSelect(page: Page, selector: string, value: string): Promise<void> {
  await humanDelay(page, DELAYS.BEFORE_CLICK);
  await page.selectOption(selector, value);
}

/**
 * Clear a field's existing value before typing new content.
 */
export async function clearAndType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector, { clickCount: 3 }); // select all
  await page.keyboard.press('Backspace');
  await humanType(page, selector, text);
}

/**
 * Wait a human-like pause between filling different form fields.
 */
export async function betweenFields(page: Page): Promise<void> {
  await humanDelay(page, DELAYS.BETWEEN_FIELDS);
}

/**
 * Wait before submitting a form (simulates "reviewing" the form).
 */
export async function beforeSubmit(page: Page): Promise<void> {
  await humanDelay(page, DELAYS.BEFORE_SUBMIT);
}
