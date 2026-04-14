import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('session:login');

// TODO: Implement Immoscout24 login flow via browser UI
// Use human simulation delays from config/constants.ts
// Persist cookies after successful login

export async function login(page: Page, email: string, password: string): Promise<void> {
  // TODO: Navigate to login page, fill credentials, submit
  throw new Error('Not implemented');
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  // TODO: Check for logged-in indicator on page
  throw new Error('Not implemented');
}
