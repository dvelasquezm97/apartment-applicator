import type { Page } from 'playwright-core';
import { createChildLogger } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { transition } from '../../lib/state-machine.js';
import { getPage, releasePage } from '../session/index.js';
import { CaptchaDetectedError } from '../../lib/errors.js';
import type { UserProfile } from '../../types/session.js';
import type { UserDocument } from '../../types/document.js';
import { navigateToListing } from './navigator.js';
import { fillApplicationForm } from './form-filler.js';
import { uploadDocuments, submitApplication } from './submitter.js';

export { navigateToListing } from './navigator.js';
export { fillApplicationForm } from './form-filler.js';
export { uploadDocuments, submitApplication } from './submitter.js';

const log = createChildLogger('auto-apply');

export interface ApplicationResult {
  status: 'APPLIED' | 'FAILED' | 'ALREADY_APPLIED' | 'LISTING_REMOVED';
  fieldsFilled: number;
  documentsUploaded: number;
  error?: string;
}

/**
 * Full auto-apply pipeline: navigate → fill form → upload docs → submit.
 *
 * Uses M1 Session Manager for authenticated pages. Integrates with the
 * state machine for APPLYING → APPLIED/FAILED transitions.
 */
export async function applyToListing(
  userId: string,
  listingId: string,
  applicationId: string,
): Promise<ApplicationResult> {
  log.info({ userId, listingId, applicationId }, 'Starting auto-apply');
  let page: Page | null = null;

  try {
    // Get authenticated browser page from M1 Session Manager
    page = await getPage(userId);

    // Fetch listing URL
    const listing = await fetchListing(listingId);
    if (!listing) {
      await transitionToFailed(applicationId, 'Listing not found in database');
      return { status: 'FAILED', fieldsFilled: 0, documentsUploaded: 0, error: 'Listing not found' };
    }

    // Phase 1: Navigate to listing and open application form
    const navResult = await navigateToListing(page, listing.url, userId);

    if (navResult.captchaDetected) {
      await takeScreenshot(page, applicationId, 'captcha');
      await transitionToFailed(applicationId, 'CAPTCHA detected');
      throw new CaptchaDetectedError(userId);
    }

    if (navResult.listingRemoved) {
      await transitionToFailed(applicationId, 'Listing no longer available (delisted)');
      await markListingDelisted(listingId);
      return { status: 'LISTING_REMOVED', fieldsFilled: 0, documentsUploaded: 0 };
    }

    if (!navResult.success) {
      await takeScreenshot(page, applicationId, 'nav-failed');
      await transitionToFailed(applicationId, 'Could not open application form');
      return { status: 'FAILED', fieldsFilled: 0, documentsUploaded: 0, error: 'Navigation failed' };
    }

    // Phase 2: Fill the application form
    const profile = await fetchProfile(userId);
    const fillResult = await fillApplicationForm(page, profile);

    // Phase 3: Upload documents
    const documents = await fetchDocuments(userId);
    let docsUploaded = 0;
    if (documents.length > 0) {
      docsUploaded = await uploadDocuments(page, documents);
    }

    // Phase 4: Submit the application
    const submitResult = await submitApplication(page);

    if (submitResult.alreadyApplied) {
      // Not an error — mark as APPLIED and move on
      await transitionToApplied(applicationId, 'Already applied (duplicate detected)');
      return { status: 'ALREADY_APPLIED', fieldsFilled: fillResult.fieldsFilled, documentsUploaded: docsUploaded };
    }

    if (!submitResult.submitted) {
      await takeScreenshot(page, applicationId, 'submit-failed');
      await transitionToFailed(applicationId, submitResult.error || 'Submission failed');
      return {
        status: 'FAILED',
        fieldsFilled: fillResult.fieldsFilled,
        documentsUploaded: docsUploaded,
        error: submitResult.error,
      };
    }

    // Success
    await transitionToApplied(applicationId, `Applied (${fillResult.fieldsFilled} fields, ${docsUploaded} docs)`);
    log.info({ userId, listingId, applicationId }, 'Auto-apply succeeded');

    return { status: 'APPLIED', fieldsFilled: fillResult.fieldsFilled, documentsUploaded: docsUploaded };
  } catch (err) {
    // CaptchaDetectedError is re-thrown for the worker to handle (circuit breaker)
    if (err instanceof CaptchaDetectedError) throw err;

    const errorMsg = (err as Error).message;
    log.error({ userId, listingId, applicationId, error: errorMsg }, 'Auto-apply failed');

    if (page) await takeScreenshot(page, applicationId, 'error').catch(() => {});
    await transitionToFailed(applicationId, errorMsg).catch(() => {});

    return { status: 'FAILED', fieldsFilled: 0, documentsUploaded: 0, error: errorMsg };
  } finally {
    if (page) {
      await releasePage(userId);
    }
  }
}

/** Fetch listing URL from database. */
async function fetchListing(listingId: string) {
  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('url, title, address')
    .eq('id', listingId)
    .single();
  if (error || !data) return null;
  return data;
}

/** Fetch user profile from database. */
async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('profile')
    .eq('id', userId)
    .single();
  if (error || !data) return {};
  return (data.profile as UserProfile) || {};
}

/** Fetch user documents for upload. Maps snake_case DB rows to camelCase UserDocument. */
async function fetchDocuments(userId: string): Promise<UserDocument[]> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    filename: row.filename,
    storageKey: row.storage_key,
    uploadedAt: row.uploaded_at,
  }));
}

/** Transition application to APPLIED status. */
async function transitionToApplied(applicationId: string, note: string): Promise<void> {
  const result = transition('APPLYING', 'APPLIED', 0, note);

  const { data: app } = await supabaseAdmin
    .from('applications')
    .select('timeline')
    .eq('id', applicationId)
    .single();

  const timeline = (app?.timeline as any[]) || [];
  timeline.push(result.timelineEntry);

  await supabaseAdmin
    .from('applications')
    .update({ status: result.newStatus, timeline })
    .eq('id', applicationId);
}

/** Transition application to FAILED status. */
async function transitionToFailed(applicationId: string, note: string): Promise<void> {
  const { data: app } = await supabaseAdmin
    .from('applications')
    .select('retry_count, timeline')
    .eq('id', applicationId)
    .single();

  const retryCount = app?.retry_count || 0;
  const result = transition('APPLYING', 'FAILED', retryCount, note);
  const timeline = (app?.timeline as any[]) || [];
  timeline.push(result.timelineEntry);

  await supabaseAdmin
    .from('applications')
    .update({ status: result.newStatus, retry_count: result.retryCount, timeline })
    .eq('id', applicationId);
}

/** Mark a listing as delisted. */
async function markListingDelisted(listingId: string): Promise<void> {
  await supabaseAdmin
    .from('listings')
    .update({ status: 'delisted' })
    .eq('id', listingId);
}

/** Take a screenshot and upload to Supabase Storage for debugging. */
async function takeScreenshot(page: Page, applicationId: string, label: string): Promise<void> {
  try {
    const buffer = await page.screenshot({ fullPage: false });
    const path = `screenshots/${applicationId}/${label}-${Date.now()}.png`;
    await supabaseAdmin.storage
      .from('application-screenshots')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    log.debug({ applicationId, label, path }, 'Screenshot uploaded');
  } catch (err) {
    log.warn({ applicationId, error: (err as Error).message }, 'Failed to take screenshot');
  }
}
