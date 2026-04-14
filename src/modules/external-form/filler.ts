import type { Page } from 'playwright-core';
import type { FormAnalysis, FormField } from '../../types/form.js';
import type { UserProfile } from '../../types/session.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('external-form:filler');

// TODO: Fill form fields, handle pending questions, submit
// Auto-fill from profile, ask user for unknown fields via Telegram

export async function fillForm(
  page: Page,
  analysis: FormAnalysis,
  profile: UserProfile,
): Promise<FormField[]> {
  // TODO: Fill mapped fields, return unmapped fields
  throw new Error('Not implemented');
}

export async function submitForm(page: Page): Promise<Buffer> {
  // TODO: Submit form, capture confirmation screenshot
  throw new Error('Not implemented');
}
