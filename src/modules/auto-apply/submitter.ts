import type { Page } from 'playwright-core';
import type { UserDocument } from '../../types/document.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('auto-apply:submitter');

// TODO: Upload documents, submit form, verify success

export async function uploadDocuments(page: Page, documents: UserDocument[]): Promise<void> {
  // TODO: Upload each document to the application form
  throw new Error('Not implemented');
}

export async function submitApplication(page: Page): Promise<boolean> {
  // TODO: Click submit, verify success message
  throw new Error('Not implemented');
}
