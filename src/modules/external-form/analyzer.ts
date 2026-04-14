import type { FormAnalysis } from '../../types/form.js';
import type { UserProfile } from '../../types/session.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('external-form:analyzer');

// TODO: Use Claude API to analyze form HTML
// Extract field schema, map to user profile keys
// Identify unmapped fields that need user input

export async function analyzeForm(
  html: string,
  userProfile: UserProfile,
): Promise<FormAnalysis> {
  // TODO: Send cleaned HTML to Claude API, parse structured response
  throw new Error('Not implemented');
}
