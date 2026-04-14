# CTO Technical Plan: BerlinKeys M3 Auto-Apply

**Date:** 2026-04-15
**Ideate brief:** .agents/briefs/2026-04-14-ideate-aucto.md
**COO verdict:** GO (skipped — continuation of approved product)
**Module spec:** docs/modules/03-auto-apply.md
**Paperclip project:** M3 Auto-Apply (bdf7d1b6)

## Technical Overview

M3 consumes jobs enqueued by M2 (Listing Monitor) and performs the core value action: navigating to an Immoscout24 listing, filling the application form with user profile data, uploading documents from Supabase Storage, and submitting. It uses M1 (Session Manager) for authenticated browser pages and the existing state machine for application lifecycle transitions (APPLYING → APPLIED/FAILED). Human simulation delays, CAPTCHA detection, and screenshot-on-failure are all carried over from the M1/M2 patterns.

## Files to Create

| File | Description |
|------|-------------|
| `src/modules/auto-apply/selectors.ts` | Centralized CSS selector registry for Immoscout listing pages and application forms |
| `src/modules/auto-apply/human-delay.ts` | Human simulation utilities: typing, clicking, scrolling, delays (extracted from M1 patterns) |
| `tests/unit/navigator.test.ts` | Unit tests for listing navigation and apply button detection |
| `tests/unit/form-filler.test.ts` | Unit tests for profile-to-form field mapping |
| `tests/unit/submitter.test.ts` | Unit tests for document upload and submission logic |
| `tests/integration/auto-apply.test.ts` | End-to-end auto-apply flow with mocked Playwright page |
| `tests/fixtures/application-form.html` | Saved Immoscout24 application form HTML for testing |

## Files to Modify

| File | Changes |
|------|---------|
| `src/modules/auto-apply/index.ts` | Add `applyToListing()` orchestration function — the main pipeline |
| `src/modules/auto-apply/navigator.ts` | Full implementation: navigate to listing, detect availability, find apply button |
| `src/modules/auto-apply/form-filler.ts` | Full implementation: map profile fields to form, fill with human typing |
| `src/modules/auto-apply/submitter.ts` | Full implementation: download docs via signed URLs, upload, submit, verify |
| `src/workers/auto-apply.worker.ts` | Full worker: get page → run pipeline → update state machine → handle errors |
| `docs/BROWSER_AUTOMATION.md` | Fill in "Listing Page" and "Application Form" selector sections |
| `docs/MODULES.md` | Update M3 status to IN_PROGRESS → COMPLETE |

## Data Model Changes

None. All required tables (applications, documents, listings, users) and the application_status enum already exist from the scaffold migration.

## Implementation Order

### Phase 1: Foundation (selectors + human simulation)
1. **selectors.ts** — Immoscout CSS selectors for listing page elements, apply button variants, form fields, success/error messages, already-applied indicators
2. **human-delay.ts** — Reusable `humanDelay()`, `humanType()`, `humanClick()`, `humanScroll()` functions using constants from `DELAYS` config

### Phase 2: Core Pipeline (navigator → form-filler → submitter)
3. **navigator.ts** — Navigate to listing URL, wait for page load, detect "listing removed" page, detect CAPTCHA, find "Kontaktieren"/"Nachricht schreiben" button, click to open application form (may be inline or modal overlay)
4. **form-filler.ts** — Map `UserProfile` fields to Immoscout form selectors:
   - Name → `input[name*="name"]` or similar
   - Email → email field (may be pre-filled from login)
   - Phone → phone field
   - Move-in date → date picker or text
   - Message/cover letter → textarea (compose from profile or template)
   - Employment, income, persons, pets → dropdowns/radios
   - Handle missing optional fields gracefully (skip, log warning)
5. **submitter.ts** — Download documents from Supabase Storage via signed URLs to temp dir, set file inputs via `page.setInputFiles()`, submit form, detect success message, detect already-applied message, detect error, take screenshot on failure

### Phase 3: Orchestration + Worker
6. **index.ts** — `applyToListing(userId, listingId, applicationId)`:
   - Get authenticated page from M1 Session Manager
   - Run navigate → fill → upload → submit pipeline
   - On success: transition application APPLYING → APPLIED via state machine
   - On failure: transition APPLYING → FAILED, take screenshot, store in application-screenshots bucket
   - Always release page back to session manager
   - Return `ApplicationResult` with status and details
7. **auto-apply.worker.ts** — BullMQ worker:
   - Extract `userId`, `listingId`, `applicationId` from job data
   - Check `automation_paused` flag — skip if paused
   - Call `applyToListing()`
   - On FAILED with retryCount < 3: transition FAILED → APPLYING (retry via state machine)
   - On FAILED with retryCount >= 3: transition to CLOSED, alert via Telegram
   - Log statistics, update timeline

### Phase 4: Tests
8. **Unit tests** — Form field mapping, navigator detection logic, submitter success/failure parsing
9. **Integration test** — Full pipeline with mocked Playwright `Page`, mocked Supabase client, verify state transitions

### Phase 5: Docs
10. Update `BROWSER_AUTOMATION.md` selector registry
11. Update `MODULES.md` status

## Test Strategy

### Unit Tests
| Test file | What's tested |
|-----------|--------------|
| `tests/unit/navigator.test.ts` | Listing available detection, listing removed detection, apply button found/not found, CAPTCHA detection delegation |
| `tests/unit/form-filler.test.ts` | Profile field → form field mapping, partial profile handling (missing fields skipped), dropdown vs text input handling |
| `tests/unit/submitter.test.ts` | Success message detection, error message detection, already-applied detection, file input interaction |

### Integration Tests
| Test file | What's tested |
|-----------|--------------|
| `tests/integration/auto-apply.test.ts` | Full apply pipeline: navigate → fill → upload → submit → state transition. Mock Playwright page with fixture HTML. Mock Supabase for document URLs and DB updates. Verify APPLYING → APPLIED on success, APPLYING → FAILED on error. |

### Edge Cases
- Listing removed between enqueue and apply attempt
- CAPTCHA appears mid-form-fill
- Already applied to this listing (duplicate detection)
- Document download fails (Supabase Storage unreachable)
- Form has unexpected/new fields not in our mapping
- Modal form vs inline form layout differences
- Network timeout during submission
- Application succeeds but success detection fails (conservative: mark APPLIED if no error detected)

## Agent Assignments

### Builder (Claude Code) — Direct implementation
- **Task:** Implement all M3 files in phases 1-4
- **Focus:** Human simulation correctness, selector resilience, error handling coverage
- **Depends on:** Nothing (M1/M2 complete)
- **Acceptance:** All unit and integration tests pass; `npm run typecheck` clean

### Codex CLI — `/codex` + pre-commit hook
- **Task:** Independent review of every M3 commit
- **Focus:** Anti-detection patterns (are delays realistic?), form interaction correctness, document handling security (no PII logging, no disk persistence)
- **Depends on:** Each commit from Builder
- **Acceptance:** All commits pass Codex review or issues are addressed

### Staff Engineer — `/review`
- **Task:** Pre-ship diff review of full M3 implementation
- **Focus:** State machine integration correctness, error recovery paths, selector brittleness risk
- **Depends on:** Builder complete
- **Acceptance:** No blocking issues in review

### Compliance Officer — `/compliance-check`
- **Task:** Verify document handling and PII safety
- **Focus:** Documents fetched via signed URLs (never stored permanently on disk), PII from UserProfile never appears in logs, failure screenshots don't capture filled form data
- **Depends on:** Builder complete
- **Acceptance:** No compliance violations

### Release Engineer — `/ship`
- **Task:** Create PR, update docs
- **Focus:** Clean PR with updated MODULES.md and BROWSER_AUTOMATION.md
- **Depends on:** Staff Engineer + Compliance Officer pass
- **Acceptance:** PR created, CI green

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Immoscout changes form layout/selectors | All selectors centralized in `selectors.ts` — single file to update. Screenshot on failure captures current state for debugging. |
| Bot detection from form-filling speed | Human simulation delays between every action. Character-by-character typing. Random pauses. Serialized applications (concurrency: 1). |
| CAPTCHA during application | Detect via M1's CAPTCHA detector. Circuit breaker pauses all jobs. Screenshot + Telegram alert for manual resolution. |
| Document upload failure | Signed URLs with 5-min expiry. Download to temp, upload via setInputFiles, delete temp. Retry once on upload failure. |
| Already-applied duplicate | Detect Immoscout's "already applied" message. Mark as APPLIED (not FAILED). Skip gracefully. |
| State machine inconsistency | All transitions go through `transitionApplication()` in state-machine.ts. Invalid transitions throw and alert. |
| PII leakage in logs/screenshots | Logger redacts profile fields. Screenshots taken BEFORE form fill on error, or with form blurred. |

## Build Order

```
1. Builder: selectors.ts + human-delay.ts (foundation)
2. Builder: navigator.ts (Phase 2a)
3. Builder: form-filler.ts (Phase 2b)
4. Builder: submitter.ts (Phase 2c)
5. Builder: index.ts orchestrator + worker (Phase 3)
6. Builder: tests (Phase 4)
7. Codex: reviews on each commit (continuous)
8. Staff Engineer: /review (Phase 5)
9. Compliance Officer: /compliance-check (Phase 5)
10. Release Engineer: /ship (Phase 6)
```

## Paperclip Issues

| # | Title | Agent | ID |
|---|-------|-------|----|
| P | M3: Auto-Apply — Full module implementation | CTO | 0ea56c1d |
| 1 | Build selectors registry and human simulation utilities | Builder | 0ce638cf |
| 2 | Implement navigator.ts | Builder | abfa2aa8 |
| 3 | Implement form-filler.ts | Builder | f5f9cd16 |
| 4 | Implement submitter.ts | Builder | aa5ce3b4 |
| 5 | Implement auto-apply orchestrator + worker | Builder | 040633b5 |
| 6 | Unit and integration tests | Builder | 9b5b6b7c |
| 7 | Codex review all commits | Codex CLI | b5cb1bf1 |
| 8 | Pre-ship diff review | Staff Engineer | ab5f0d52 |
| 9 | Compliance check | Compliance Officer | ff47f7a2 |
| 10 | Ship via PR | Release Engineer | 2480ea8a |
