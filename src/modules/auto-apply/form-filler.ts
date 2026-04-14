import type { Page } from 'playwright-core';
import type { UserProfile } from '../../types/session.js';
import { createChildLogger } from '../../lib/logger.js';
import { FORM } from './selectors.js';
import { humanType, humanSelect, clearAndType, betweenFields } from './human-delay.js';

const log = createChildLogger('auto-apply:form-filler');

/**
 * Mapping from UserProfile keys to Immoscout form field selectors and fill strategies.
 */
interface FieldMapping {
  profileKey: keyof UserProfile | null;
  selector: string;
  type: 'text' | 'select' | 'textarea';
  /** Transform profile value to form value (e.g. income number → string) */
  transform?: (value: string | number) => string;
  /** Static value when profileKey is null */
  staticValue?: string;
  required: boolean;
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { profileKey: 'name', selector: FORM.FIELDS.firstName, type: 'text', required: true,
    transform: (v) => String(v).split(' ')[0] || String(v) },
  { profileKey: 'name', selector: FORM.FIELDS.lastName, type: 'text', required: true,
    transform: (v) => String(v).split(' ').slice(1).join(' ') || String(v) },
  { profileKey: null, selector: FORM.FIELDS.email, type: 'text', required: false,
    staticValue: undefined }, // email is typically pre-filled from login
  { profileKey: 'phone', selector: FORM.FIELDS.phone, type: 'text', required: false },
  { profileKey: 'moveInDate', selector: FORM.FIELDS.moveInDate, type: 'text', required: false },
  { profileKey: 'occupation', selector: FORM.FIELDS.employment, type: 'select', required: false },
  { profileKey: 'income', selector: FORM.FIELDS.income, type: 'text', required: false,
    transform: (v) => String(v) },
  { profileKey: 'numberOfPersons', selector: FORM.FIELDS.numberOfPersons, type: 'text', required: false,
    transform: (v) => String(v) },
];

export interface FormFillerResult {
  fieldsFilled: number;
  fieldsSkipped: string[];
  messageFilled: boolean;
}

/**
 * Fill the Immoscout24 application form from user profile data.
 * Skips fields that are missing from the profile or not found on the form.
 * Uses human-like typing delays between all interactions.
 */
export async function fillApplicationForm(page: Page, profile: UserProfile): Promise<FormFillerResult> {
  log.info('Starting form fill');

  let fieldsFilled = 0;
  const fieldsSkipped: string[] = [];

  // Wait for form to be present
  const formFound = await waitForForm(page);
  if (!formFound) {
    log.warn('Application form container not found');
    return { fieldsFilled: 0, fieldsSkipped: ['form_container'], messageFilled: false };
  }

  // Fill each mapped field
  for (const mapping of FIELD_MAPPINGS) {
    const filled = await fillField(page, mapping, profile);
    if (filled) {
      fieldsFilled++;
      await betweenFields(page);
    } else {
      const selectorName = mapping.selector.split(',')[0]?.trim() || mapping.selector;
      fieldsSkipped.push(selectorName);
    }
  }

  // Fill the message/cover letter textarea
  const messageFilled = await fillMessage(page, profile);
  if (messageFilled) fieldsFilled++;

  log.info({ fieldsFilled, fieldsSkipped: fieldsSkipped.length }, 'Form fill complete');
  return { fieldsFilled, fieldsSkipped, messageFilled };
}

/**
 * Wait for the application form container to appear on the page.
 */
async function waitForForm(page: Page): Promise<boolean> {
  for (const selector of FORM.CONTAINER) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 5_000 });
      if (el) return true;
    } catch {
      // Try next selector
    }
  }
  return false;
}

/**
 * Fill a single form field based on the mapping configuration.
 */
async function fillField(page: Page, mapping: FieldMapping, profile: UserProfile): Promise<boolean> {
  // Determine the value to fill
  let value: string | undefined;
  if (mapping.staticValue !== undefined) {
    value = mapping.staticValue;
  } else if (mapping.profileKey) {
    const raw = profile[mapping.profileKey];
    if (raw === undefined || raw === null || raw === '') {
      if (mapping.required) {
        log.warn({ field: mapping.profileKey }, 'Required profile field missing');
      }
      return false;
    }
    value = mapping.transform ? mapping.transform(raw) : String(raw);
  } else {
    return false; // No value source
  }

  if (!value) return false;

  // Try each selector variant (comma-separated in the FORM.FIELDS values)
  const selectors = mapping.selector.split(',').map(s => s.trim());

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;

      const isVisible = await el.isVisible();
      if (!isVisible) continue;

      // Auto-detect element type: if the matched element is a <select>, use selectOption
      const tagName = await el.evaluate((node: Element) => node.tagName.toLowerCase());
      if (tagName === 'select') {
        await humanSelect(page, selector, value);
      } else if (tagName === 'textarea') {
        await clearAndType(page, selector, value);
      } else {
        // Check if field already has a value (e.g. pre-filled email)
        const currentValue = await el.inputValue().catch(() => '');
        if (currentValue && currentValue.length > 0) {
          log.debug({ selector }, 'Field already has a value, skipping');
          return true; // Count as filled
        }
        await clearAndType(page, selector, value);
      }

      log.debug({ field: mapping.profileKey || 'static' }, 'Field filled');
      return true;
    } catch {
      // Selector didn't match or not interactable, try next variant
    }
  }

  return false;
}

/**
 * Compose and fill the message/cover letter field.
 * Generates a German-language message from profile data.
 */
async function fillMessage(page: Page, profile: UserProfile): Promise<boolean> {
  const selectors = FORM.FIELDS.message.split(',').map(s => s.trim());

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;
      const isVisible = await el.isVisible();
      if (!isVisible) continue;

      const message = composeMessage(profile);
      await betweenFields(page);
      await clearAndType(page, selector, message);
      return true;
    } catch {
      // Try next selector
    }
  }

  log.warn('Message textarea not found');
  return false;
}

/**
 * Compose a polite German-language application message from profile data.
 */
function composeMessage(profile: UserProfile): string {
  const name = profile.name || '';
  const occupation = profile.occupation ? ` Ich bin ${profile.occupation}` : '';
  const employer = profile.employer ? ` bei ${profile.employer}` : '';
  const income = profile.income ? ` und verdiene ${profile.income}€ netto monatlich` : '';
  const moveIn = profile.moveInDate ? `\n\nMein gewünschter Einzugstermin ist der ${profile.moveInDate}.` : '';

  return [
    `Sehr geehrte Damen und Herren,`,
    ``,
    `ich interessiere mich sehr für Ihre Wohnung und würde mich über eine Besichtigung freuen.${occupation}${employer}${income}.`,
    moveIn,
    ``,
    `Alle erforderlichen Unterlagen (Einkommensnachweis, SCHUFA, etc.) kann ich Ihnen gerne zur Verfügung stellen.`,
    ``,
    `Mit freundlichen Grüßen`,
    name,
  ].join('\n');
}
