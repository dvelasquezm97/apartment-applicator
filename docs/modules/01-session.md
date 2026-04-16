# Module 1: Immoscout Session Manager

> Last updated: 2026-04-16
> Status: COMPLETE

## Purpose

Manage Playwright browser lifecycle for Immoscout24. Provides authenticated
browser pages to all other modules via a checkout/return pool pattern.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/session/index.ts | Module exports: getPage(), releasePage(), shutdown() |
| src/modules/session/browser-pool.ts | Browser pool: max N instances, checkout/return |
| src/modules/session/login.ts | Immoscout24 SSO login flow (two-step: email then password) |
| src/modules/session/cookie-store.ts | Encrypt/decrypt cookies, persist to Supabase (`bk_users`) |
| src/modules/session/captcha-detector.ts | GeeTest CAPTCHA detection, circuit breaker trigger |
| scripts/manual-login.ts | Manual login script: user logs in via visible browser, cookies saved |

## Login Flow (SSO)

**URL:** `https://sso.immobilienscout24.de/sso/login?appName=is24main`
(Old URL `https://www.immobilienscout24.de/anbieter/login.html` is dead)

1. Navigate to SSO login page
2. Dismiss cookie consent banner ("Alle akzeptieren")
3. Enter email in `input[name="username"]` → submit
4. Wait for password page to load
5. Enter password in `input[name="password"]` → submit
6. GeeTest CAPTCHA may appear → `waitForManualCaptchaSolve()` (2 min timeout)
7. On success: serialize cookies → encrypt → store in `bk_users.immoscout_cookies_encrypted`

**Recommended approach:** Use `scripts/manual-login.ts` or Arc browser CDP to avoid CAPTCHA entirely. Cookies persist for days/weeks.

## Inputs

- Encrypted Immoscout cookies from Supabase `bk_users.immoscout_cookies_encrypted`
- Encrypted password from Supabase `bk_users.immoscout_password_encrypted`
- ENCRYPTION_KEY env var for AES-256-GCM
- BROWSER_POOL_SIZE env var (default 2)
- HEADLESS env var (default true)

## Outputs

- Authenticated Playwright `Page` object ready for Immoscout navigation
- Updated encrypted cookies persisted to Supabase after each session

## Dependencies

- None (foundational module — all browser modules depend on this)

## Key Functions

```typescript
// Get an authenticated browser page for a user
getPage(userId: string): Promise<Page>

// Return a page to the pool after use
releasePage(userId: string): Promise<void>

// Graceful shutdown: persist all cookies, close all browsers
shutdown(): Promise<void>

// Check if a user's session is healthy
isSessionHealthy(userId: string): Promise<boolean>
```

## Error Handling

- **Cookie expiry:** Detected when navigation to authenticated page redirects
  to login. Auto re-login, persist new cookies.
- **CAPTCHA detected (GeeTest):** Screenshot evidence → `waitForManualCaptchaSolve()` (2 min)
  → if not solved: circuit breaker OPEN → Telegram alert → pause all jobs → wait for /resume
- **Browser crash:** Playwright auto-restart, re-create context from saved cookies
- **Login failure:** Retry 2x with backoff, then circuit breaker

## Queue Config

No BullMQ queue — this module is synchronous, called by other workers.

## Testing

- Mock Playwright browser and page objects
- Test cookie encryption round-trip (encrypt → store → decrypt → verify)
- Test circuit breaker state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- Test pool checkout/return (max capacity, queue waiting)

## Open Issues

- GeeTest CAPTCHA blocks all headless login attempts — must use manual-login.ts or Arc CDP for initial cookie capture
- Cookies expire after days/weeks — need monitoring to detect when re-login is required
