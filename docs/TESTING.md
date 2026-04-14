# Testing

> Last updated: 2026-04-14
> Status: DESIGNED

## Test Runner

- **Framework:** Vitest
- **Config:** vitest.config.ts (root)
- **Run:** `npm test` (single run), `npm run test:watch` (watch mode)
- **Coverage:** `npm run test:coverage`

## Unit Tests

### State Machine (tests/unit/state-machine.test.ts)

Test ALL valid transitions from docs/DATA_MODEL.md:
- APPLYING → APPLIED (success)
- APPLYING → FAILED (failure)
- FAILED → APPLYING (retry when retry_count < 3)
- FAILED → CLOSED (retry when retry_count >= 3)
- All 15+ valid transitions

Test ALL invalid transitions throw:
- APPLYING → CLOSED (invalid)
- APPLIED → APPLYING (invalid)
- CLOSED → anything (invalid — terminal state)
- Every combination not in the valid set

Test timeline appending:
- Each transition appends {status, timestamp, note} to timeline array

### Message Classifier (tests/unit/classifier.test.ts)

Test rule-based classification:
- German: "Bitte senden Sie uns Ihre Unterlagen" → DOCUMENT_REQUEST
- German: "Besichtigungstermin am 15.04.2026 um 14:00" → VIEWING_INVITE
- German: "Bitte füllen Sie das Formular aus: https://..." → EXTERNAL_FORM
- German: "Leider müssen wir Ihnen absagen" → REJECTION
- English equivalents for each category
- Ambiguous messages → should fall through to Claude API

### Encryption (tests/unit/encryption.test.ts)

- Round-trip: encrypt → decrypt → verify original
- Different plaintexts produce different ciphertexts (random IV)
- Wrong key fails to decrypt (auth tag mismatch)
- Empty string handling
- Unicode handling (German characters, emoji)

### Circuit Breaker (tests/unit/circuit-breaker.test.ts)

- CLOSED → OPEN after threshold failures
- OPEN → HALF_OPEN after timeout
- HALF_OPEN → CLOSED on success
- HALF_OPEN → OPEN on failure
- Manual reset (force CLOSED)
- Different thresholds for different trigger types

### Deduplication (tests/unit/dedup.test.ts)

- Known immoscout_id → returns true (duplicate)
- Unknown immoscout_id → returns false (new)
- Handles multiple simultaneous checks

## Integration Tests

### Health Endpoint (tests/integration/health.test.ts)

- All systems healthy → 200 with structured JSON
- Redis down → 503 with redis status "error"
- Supabase down → 503 with supabase status "error"
- Response format matches docs/ERROR_HANDLING.md spec

### Application Flow (tests/integration/application-flow.test.ts)

- Create application → status = APPLYING
- Transition APPLYING → APPLIED → DOCUMENTS_REQUESTED → DOCUMENTS_SENT
- Transition with invalid status → throws
- Retry flow: FAILED → APPLYING (retry_count increments)
- Max retry: FAILED → CLOSED after 3 attempts

## Mocks & Fixtures

### Mocks (tests/mocks/)

| Mock | Purpose |
|------|---------|
| supabase.ts | In-memory Supabase client mock (CRUD operations) |
| redis.ts | In-memory Redis mock (ioredis-mock) |
| playwright.ts | Mock Page, BrowserContext, Browser objects |

### Fixtures (tests/fixtures/)

| Fixture | Purpose |
|---------|---------|
| listing.ts | Sample listing objects with various states |
| application.ts | Sample applications at each status |
| message.ts | Sample inbox messages per intent category |

### Saved HTML (tests/fixtures/html/) — Created During Implementation

| File | Purpose |
|------|---------|
| saved-searches.html | Immoscout saved searches page |
| listing-detail.html | Single listing detail page |
| application-form.html | Application form page |
| inbox.html | Inbox message list |
| inbox-thread.html | Single inbox thread |

## Health Check Job

- BullMQ repeatable job: runs nightly at 03:00 Berlin time
- Purpose: verify browser session is alive WITHOUT triggering any actions
- Flow: get browser page → navigate to Immoscout homepage → check for
  logged-in indicator → release page
- On failure: Telegram alert "Nightly health check failed"
- Does NOT apply to anything or interact with inbox

## Smoke Test

`npm run smoke` — quick verification that the system starts:

1. Start Fastify server
2. Hit GET /health
3. Verify 200 response
4. Verify JSON structure
5. Shut down
6. Exit 0

Used in: CI pipeline, post-deploy verification on Railway.
