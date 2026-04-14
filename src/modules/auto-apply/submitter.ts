import type { Page } from 'playwright-core';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { UserDocument } from '../../types/document.js';
import { createChildLogger } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { FORM, RESULT } from './selectors.js';
import { humanClick, humanDelay, beforeSubmit } from './human-delay.js';

const log = createChildLogger('auto-apply:submitter');

export interface SubmitResult {
  submitted: boolean;
  alreadyApplied: boolean;
  documentsUploaded: number;
  error?: string;
}

/**
 * Upload user documents to the application form's file input.
 * Downloads from Supabase Storage via signed URLs, writes to temp dir,
 * sets file inputs, then cleans up temp files.
 */
export async function uploadDocuments(page: Page, documents: UserDocument[]): Promise<number> {
  if (documents.length === 0) {
    log.info('No documents to upload');
    return 0;
  }

  // Find the file input
  const fileInput = await findFileInput(page);
  if (!fileInput) {
    log.warn('File upload input not found on form — skipping document upload');
    return 0;
  }

  // Download documents to temp dir
  const tempDir = join(tmpdir(), `berlinkeys-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  const tempPaths: string[] = [];

  try {
    for (const doc of documents) {
      const tempPath = await downloadDocument(doc, tempDir);
      if (tempPath) {
        tempPaths.push(tempPath);
      }
    }

    if (tempPaths.length === 0) {
      log.warn('No documents could be downloaded');
      return 0;
    }

    // Upload all documents at once via file input
    await fileInput.setInputFiles(tempPaths);
    await humanDelay(page, { min: 500, max: 1500 });

    log.info({ count: tempPaths.length }, 'Documents uploaded to form');
    return tempPaths.length;
  } finally {
    // Clean up temp files — never leave documents on disk
    for (const tempPath of tempPaths) {
      await unlink(tempPath).catch(() => {});
    }
  }
}

/**
 * Submit the application form and detect the result.
 */
export async function submitApplication(page: Page): Promise<SubmitResult> {
  // Check for already-applied before submitting
  const alreadyApplied = await detectAlreadyApplied(page);
  if (alreadyApplied) {
    log.info('Already applied to this listing');
    return { submitted: false, alreadyApplied: true, documentsUploaded: 0 };
  }

  await beforeSubmit(page);

  // Find and click submit button
  const clicked = await clickSubmitButton(page);
  if (!clicked) {
    return { submitted: false, alreadyApplied: false, documentsUploaded: 0, error: 'Submit button not found' };
  }

  // Wait for response and detect result
  await page.waitForTimeout(3000);
  await humanDelay(page, { min: 1000, max: 2000 });

  // Check for success
  const success = await detectSuccess(page);
  if (success) {
    log.info('Application submitted successfully');
    return { submitted: true, alreadyApplied: false, documentsUploaded: 0 };
  }

  // Check for already-applied (might appear after submit attempt)
  const alreadyAppliedAfter = await detectAlreadyApplied(page);
  if (alreadyAppliedAfter) {
    log.info('Already applied detected after submit attempt');
    return { submitted: false, alreadyApplied: true, documentsUploaded: 0 };
  }

  // Check for explicit error
  const error = await detectError(page);
  if (error) {
    log.warn({ error }, 'Form submission error detected');
    return { submitted: false, alreadyApplied: false, documentsUploaded: 0, error };
  }

  // No success, no error — conservatively assume success
  // (some forms redirect or show minimal confirmation)
  log.info('No explicit success/error detected — assuming success');
  return { submitted: true, alreadyApplied: false, documentsUploaded: 0 };
}

/**
 * Find the file upload input on the form.
 */
async function findFileInput(page: Page) {
  const selectors = FORM.FILE_INPUT.split(',').map(s => s.trim());
  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Download a document from Supabase Storage to a temp file.
 * Returns the temp file path, or null on failure.
 */
async function downloadDocument(doc: UserDocument, tempDir: string): Promise<string | null> {
  try {
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('user-documents')
      .createSignedUrl(doc.storageKey, 300); // 5-minute expiry

    if (urlError || !signedUrlData?.signedUrl) {
      log.error({ docId: doc.id, error: urlError?.message }, 'Failed to create signed URL');
      return null;
    }

    const response = await fetch(signedUrlData.signedUrl);
    if (!response.ok || !response.body) {
      log.error({ docId: doc.id, status: response.status }, 'Failed to download document');
      return null;
    }

    const tempPath = join(tempDir, doc.filename);
    const writeStream = createWriteStream(tempPath);
    await pipeline(Readable.fromWeb(response.body as any), writeStream);

    log.debug({ docId: doc.id, filename: doc.filename }, 'Document downloaded to temp');
    return tempPath;
  } catch (err) {
    log.error({ docId: doc.id, error: (err as Error).message }, 'Document download failed');
    return null;
  }
}

/**
 * Click the form submit button. Tries multiple selector variants.
 */
async function clickSubmitButton(page: Page): Promise<boolean> {
  for (const selector of FORM.SUBMIT) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isVisible = await el.isVisible();
        if (isVisible) {
          await humanClick(page, selector);
          return true;
        }
      }
    } catch {
      // Try next selector
    }
  }
  log.warn('Submit button not found');
  return false;
}

/**
 * Detect a success message on the page after form submission.
 */
async function detectSuccess(page: Page): Promise<boolean> {
  for (const selector of RESULT.SUCCESS) {
    try {
      const el = await page.$(selector);
      if (el) return true;
    } catch {
      // Try next
    }
  }
  return false;
}

/**
 * Detect an "already applied" message.
 */
async function detectAlreadyApplied(page: Page): Promise<boolean> {
  for (const selector of RESULT.ALREADY_APPLIED) {
    try {
      const el = await page.$(selector);
      if (el) return true;
    } catch {
      // Try next
    }
  }
  return false;
}

/**
 * Detect an error message and return its text.
 */
async function detectError(page: Page): Promise<string | null> {
  for (const selector of RESULT.ERROR) {
    try {
      const el = await page.$(selector);
      if (el) {
        const text = await el.textContent();
        return text?.trim() || 'Unknown form error';
      }
    } catch {
      // Try next
    }
  }
  return null;
}
