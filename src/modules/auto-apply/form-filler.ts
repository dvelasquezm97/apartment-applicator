import type { Page } from 'playwright-core';
import type { UserProfile } from '../../types/session.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('auto-apply:form-filler');

// TODO: Fill application form fields from user profile
// Use human simulation delays between fields

export async function fillApplicationForm(page: Page, profile: UserProfile): Promise<void> {
  // TODO: Map profile fields to form fields, fill with human-like typing
  throw new Error('Not implemented');
}
