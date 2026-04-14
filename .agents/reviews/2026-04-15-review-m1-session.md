# Staff Engineer Review: M1 Session Manager

**Date:** 2026-04-15
**Reviewer:** Staff Engineer

## P1 Findings (all fixed)

1. **Race condition in idle timer callback** — async eviction not awaited in setTimeout. Fixed: added `.catch()` for explicit error handling.
2. **Missing error handling on page navigation** — `page.goto()` and `waitForLoadState()` could fail silently. Fixed: wrapped in try-catch with context.
3. **Unhandled rejection on idle eviction** — evictEntry promise rejection unhandled. Fixed: `.catch()` added.
4. **Decrypt without validation** — password decrypt could throw on corrupted data without context. Fixed: wrapped in try-catch with log.

## P2 Findings (accepted, not blocking)

1. Captcha breaker Map never cleaned — acceptable for current scale, revisit at M2.
2. Cookie persistence race on eviction — logged but not blocking, cookies are best-effort cache.
3. Missing context validity check before addCookies — low probability, context managed by pool.
4. CAPTCHA threshold of 1 — intentionally aggressive per SECURITY.md spec.

## Verdict: PASS (after P1 fixes applied)

54 tests passing. Typecheck clean. All P1 issues resolved.
