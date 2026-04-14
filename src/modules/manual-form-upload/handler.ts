import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('manual-form-upload:handler');

// TODO: Handle dashboard form upload (PDF or URL)
// Reuses Module 7 analyzer + filler logic

export interface FormInput {
  type: 'url' | 'pdf';
  url?: string;
  fileBuffer?: Buffer;
  filename?: string;
}

export async function handleFormUpload(
  userId: string,
  applicationId: string,
  formInput: FormInput,
): Promise<void> {
  // TODO: Process uploaded form, trigger auto-fill
  throw new Error('Not implemented');
}
