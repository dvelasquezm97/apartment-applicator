import { describe, it, expect } from 'vitest';

describe('Application Flow', () => {
  // TODO: Test full application lifecycle against mock Supabase
  it.todo('creates application in APPLYING status');
  it.todo('transitions through happy path: APPLYING → APPLIED → DOCUMENTS_REQUESTED → DOCUMENTS_SENT');
  it.todo('handles retry flow: FAILED → APPLYING with retry_count increment');
  it.todo('closes after max retries: FAILED → CLOSED');
});
