import type { Page } from 'playwright-core';
import type { UserProfile } from '../../types/session.js';
import { createChildLogger } from '../../lib/logger.js';
import { FORM } from './selectors.js';
import { humanType, humanSelect, clearAndType, betweenFields } from './human-delay.js';

const log = createChildLogger('auto-apply:form-filler');

/**
 * Mapping from UserProfile keys to Immoscout form field selectors and fill strategies.
 * Updated 2026-04-16 to match real Immoscout contact form fields.
 */
interface FieldMapping {
  profileKey: keyof UserProfile | null;
  selector: string;
  type: 'text' | 'select' | 'textarea';
  transform?: (value: string | number) => string;
  staticValue?: string;
  required: boolean;
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { profileKey: 'name', selector: FORM.FIELDS.firstName, type: 'text', required: true,
    transform: (v) => String(v).split(' ')[0] || String(v) },
  { profileKey: 'name', selector: FORM.FIELDS.lastName, type: 'text', required: true,
    transform: (v) => String(v).split(' ').slice(1).join(' ') || String(v) },
  { profileKey: null, selector: FORM.FIELDS.email, type: 'text', required: false,
    staticValue: undefined }, // email is typically pre-filled
  { profileKey: 'phone', selector: FORM.FIELDS.phone, type: 'text', required: false },
  { profileKey: 'street', selector: FORM.FIELDS.street, type: 'text', required: false },
  { profileKey: 'houseNumber', selector: FORM.FIELDS.houseNumber, type: 'text', required: false },
  { profileKey: 'zipCode', selector: FORM.FIELDS.zipCode, type: 'text', required: false },
  { profileKey: 'city', selector: FORM.FIELDS.city, type: 'text', required: false },
];

export interface FormFillerResult {
  fieldsFilled: number;
  fieldsSkipped: string[];
  messageFilled: boolean;
}

/**
 * Fill the Immoscout24 application form from user profile data.
 * Updated for the new contact form modal (verified 2026-04-16).
 */
export async function fillApplicationForm(page: Page, profile: UserProfile): Promise<FormFillerResult> {
  log.info('Starting form fill');

  let fieldsFilled = 0;
  const fieldsSkipped: string[] = [];

  // Wait for form modal to appear
  const formFound = await waitForForm(page);
  if (!formFound) {
    log.warn('Application form container not found');
    return { fieldsFilled: 0, fieldsSkipped: ['form_container'], messageFilled: false };
  }

  // Fill the message/cover letter textarea first (it's at the top of the modal)
  const messageFilled = await fillMessage(page, profile);
  if (messageFilled) fieldsFilled++;

  // Fill salutation select if present
  await fillSalutation(page);

  // Fill each mapped field
  for (const mapping of FIELD_MAPPINGS) {
    const filled = await fillField(page, mapping, profile);
    if (filled) {
      fieldsFilled++;
      await betweenFields(page);
    } else {
      const selectorName = mapping.profileKey || mapping.selector.split(',')[0]?.trim();
      fieldsSkipped.push(String(selectorName));
    }
  }

  // Handle extra questions (insolvency, arrears, pets, smoking) — always "Nein"
  await answerExtraQuestions(page);

  // Ensure profile sharing toggle is enabled
  await ensureProfileSharing(page);

  log.info({ fieldsFilled, fieldsSkipped: fieldsSkipped.length }, 'Form fill complete');
  return { fieldsFilled, fieldsSkipped, messageFilled };
}

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

async function fillField(page: Page, mapping: FieldMapping, profile: UserProfile): Promise<boolean> {
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
    return false;
  }

  if (!value) return false;

  const selectors = mapping.selector.split(',').map(s => s.trim());

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;

      const isVisible = await el.isVisible();
      if (!isVisible) continue;

      const tagName = await el.evaluate((node: Element) => node.tagName.toLowerCase());
      if (tagName === 'select') {
        await humanSelect(page, selector, value);
      } else if (tagName === 'textarea') {
        await clearAndType(page, selector, value);
      } else {
        // Skip if already pre-filled (e.g. email)
        const currentValue = await el.inputValue().catch(() => '');
        if (currentValue && currentValue.length > 0) {
          log.debug({ selector }, 'Field already has a value, skipping');
          return true;
        }
        await clearAndType(page, selector, value);
      }

      log.debug({ field: mapping.profileKey || 'static' }, 'Field filled');
      return true;
    } catch {
      // Try next variant
    }
  }

  return false;
}

/**
 * Fill the salutation select — always "Herr".
 */
async function fillSalutation(page: Page): Promise<void> {
  try {
    const selects = await page.$$('select');
    for (const select of selects) {
      const options = await select.evaluate((el: HTMLSelectElement) =>
        Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
      );
      const herrOption = options.find(o =>
        o.text.toLowerCase().includes('herr') && !o.text.toLowerCase().includes('frau')
      );
      if (herrOption) {
        await select.selectOption(herrOption.value);
        log.debug('Salutation set to Herr');
        return;
      }
    }
  } catch {
    log.debug('No salutation select found — may not be required');
  }
}

/**
 * Answer extra questions (insolvency, arrears, pets, smoking) — always "Nein" / false.
 */
async function answerExtraQuestions(page: Page): Promise<void> {
  try {
    // Find all select dropdowns in the form that have Ja/Nein options
    const selects = await page.$$('[role="dialog"] select, .ReactModal__Content select');
    for (const select of selects) {
      const options = await select.evaluate((el: HTMLSelectElement) =>
        Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
      );
      const neinOption = options.find(o => o.text.toLowerCase() === 'nein');
      if (neinOption) {
        const currentVal = await select.evaluate((el: HTMLSelectElement) => el.value);
        // Only set to Nein if not already set
        if (!currentVal || currentVal === '' || currentVal === options[0]?.value) {
          await select.selectOption(neinOption.value);
          log.debug('Extra question answered: Nein');
        }
      }
    }
  } catch {
    log.debug('No extra questions found');
  }
}

/**
 * Ensure the "Anbieter:in darf dein Profil sehen" toggle is enabled.
 */
async function ensureProfileSharing(page: Page): Promise<void> {
  try {
    const toggleSelectors = FORM.PROFILE_SHARING_TOGGLE.split(',').map(s => s.trim());
    for (const selector of toggleSelectors) {
      const toggle = await page.$(selector);
      if (!toggle) continue;

      const isChecked = await toggle.evaluate((el: Element) => {
        if (el.getAttribute('aria-checked') === 'true') return true;
        if ((el as HTMLInputElement).checked) return true;
        return false;
      });

      if (!isChecked) {
        await toggle.click();
        log.debug('Profile sharing toggle enabled');
      } else {
        log.debug('Profile sharing toggle already enabled');
      }
      return;
    }
  } catch {
    log.debug('Profile sharing toggle not found');
  }
}

async function fillMessage(page: Page, profile: UserProfile): Promise<boolean> {
  const selectors = FORM.FIELDS.message.split(',').map(s => s.trim());

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;
      const isVisible = await el.isVisible();
      if (!isVisible) continue;

      // Check if message is already pre-filled
      const currentValue = await el.inputValue().catch(() => '');
      if (currentValue && currentValue.length > 20) {
        log.debug('Message textarea already has content, keeping it');
        return true;
      }

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
