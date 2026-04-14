# CTO Technical Plan: BerlinKeys M1 Session Manager

**Date:** 2026-04-15
**Ideate brief:** Aucto ideation (BerlinKeys is first product)
**COO verdict:** GO

## Technical Overview

M1 Session Manager is the foundational module — every other module depends on it for authenticated browser access to Immoscout24. We implement 4 files: browser pool (checkout/return pattern), login flow (Playwright + stealth), cookie persistence (encrypt → Supabase → decrypt), and CAPTCHA detection (circuit breaker trigger). All infrastructure libraries already exist and are tested (encryption, circuit breaker, logger, Supabase clients, error classes, constants).

## Files to Implement (stubs → real code)

| File | What to build |
|------|--------------|
| `src/modules/session/browser-pool.ts` | Chromium pool: launch browsers, BrowserContext per user, checkout/return, idle timeout, max pool size, graceful shutdown |
| `src/modules/session/cookie-store.ts` | Serialize Playwright cookies → encrypt (AES-256-GCM) → store in Supabase `users.immoscout_cookies_encrypted` → decrypt → deserialize on load |
| `src/modules/session/login.ts` | Navigate to Immoscout login page, fill email/password with human-speed typing, submit, detect success/failure, handle redirects |
| `src/modules/session/captcha-detector.ts` | Check page for CAPTCHA iframes/selectors, take screenshot evidence, trigger circuit breaker OPEN, return detection result |
| `src/modules/session/index.ts` | Wire everything together: `getPage()` checks cookies → restores session or login → returns authenticated Page. `releasePage()` saves cookies → returns to pool. `shutdown()` persists all → closes browsers. |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/session.ts` | Add `CookieData` type, `PoolEntry` type if needed |

## Existing Code to Reuse (DO NOT rebuild)

| File | What it provides |
|------|-----------------|
| `src/lib/encryption.ts` | `encrypt()` / `decrypt()` — AES-256-GCM, tested |
| `src/lib/circuit-breaker.ts` | `CircuitBreaker` class — state machine, tested |
| `src/lib/supabase.ts` | `supabaseAdmin` client (bypasses RLS) |
| `src/lib/logger.ts` | `createChildLogger('session')` |
| `src/lib/errors.ts` | `CaptchaDetectedError`, `CircuitBreakerOpenError`, `EncryptionError` |
| `src/config/constants.ts` | Human simulation delays, circuit breaker thresholds, browser idle timeout |
| `src/config/env.ts` | `BROWSER_POOL_SIZE`, `HEADLESS`, `ENCRYPTION_KEY` |
| `tests/mocks/playwright.ts` | `createMockPage()`, `createMockBrowser()`, `createMockBrowserContext()` |

## Data Model Changes

None — Supabase schema already has `users.immoscout_cookies_encrypted` and `users.immoscout_password_encrypted` columns from migration 00001.

## Implementation Order

1. **cookie-store.ts** — Simplest, depends only on encryption.ts + supabase.ts. Can test independently.
2. **captcha-detector.ts** — Depends only on circuit-breaker.ts. Small, self-contained.
3. **browser-pool.ts** — Core pool logic. Depends on nothing from session module yet.
4. **login.ts** — Depends on cookie-store (to save cookies after login). Uses constants for human delays.
5. **index.ts** — Orchestrator. Wires pool + login + cookies + captcha together. Last.

## Test Strategy

| Test | Type | What it verifies |
|------|------|-----------------|
| Cookie round-trip | Unit | serialize → encrypt → store → load → decrypt → deserialize produces original cookies |
| Cookie store Supabase | Unit (mocked) | Correct Supabase calls with encrypted data |
| CAPTCHA detection | Unit (mocked) | Returns true when CAPTCHA selectors found, triggers circuit breaker |
| CAPTCHA no false positive | Unit (mocked) | Returns false on normal pages |
| Browser pool checkout | Unit (mocked) | Returns page, tracks capacity, queues when full |
| Browser pool return | Unit (mocked) | Page returned, capacity freed |
| Browser pool shutdown | Unit (mocked) | All contexts closed, cookies persisted |
| Login flow | Unit (mocked) | Fills form, submits, detects success/failure |
| getPage full flow | Integration (mocked) | Cookie restore → success → return page. Cookie expired → login → save cookies → return page. |

## Agent Assignments

### Builder (Claude) — direct
- **Task:** Implement all 5 session module files in order above
- **Focus:** Use existing infrastructure (encryption, circuit breaker, logger, constants). Human simulation delays from constants.ts. Playwright stealth patterns from docs/BROWSER_AUTOMATION.md.
- **Depends on:** Nothing — starting now
- **Acceptance:** All functions work, typecheck passes, tests pass

### Codex Reviewer — pre-commit hook (automatic)
- **Task:** Review every commit
- **Focus:** Encryption correctness (AES-256-GCM usage), cookie handling security, browser resource cleanup (no leaked contexts/pages), pool concurrency safety
- **Depends on:** Each commit from Builder
- **Acceptance:** No P1 findings

### Compliance Officer — `/compliance-check`
- **Task:** Audit M1 for credential handling, encryption, data privacy
- **Focus:** Immoscout passwords encrypted at rest, cookies encrypted at rest, no credentials in logs, AES-256-GCM used correctly, encryption key not hardcoded
- **Depends on:** Builder completes implementation
- **Acceptance:** No P0 findings

### Staff Engineer — `/review`
- **Task:** Pre-ship review of full M1 diff
- **Focus:** Resource leaks, error handling completeness, circuit breaker integration correctness
- **Depends on:** Builder + Compliance complete
- **Acceptance:** PASS

### Release Engineer — `/ship`
- **Task:** Create PR for M1
- **Depends on:** Review passes
- **Acceptance:** PR created, tests pass in CI

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Immoscout changes login page | Selectors are constants, easy to update. Screenshot on failure for debugging. |
| CAPTCHA blocks automation | Circuit breaker pauses all jobs. Telegram alert for manual intervention. |
| Cookie encryption key rotation | Decrypt with old key, re-encrypt with new key. Document in SECURITY.md. |
| Browser pool memory leak | Idle timeout (30min) closes unused contexts. Shutdown hook persists and closes all. |

## Build Order

```
1. Builder implements cookie-store.ts + tests        → Codex reviews commit
2. Builder implements captcha-detector.ts + tests     → Codex reviews commit
3. Builder implements browser-pool.ts + tests         → Codex reviews commit
4. Builder implements login.ts + tests                → Codex reviews commit
5. Builder implements index.ts + integration tests    → Codex reviews commit
6. Compliance Officer runs /compliance-check
7. Staff Engineer runs /review
8. Release Engineer runs /ship → PR
```
