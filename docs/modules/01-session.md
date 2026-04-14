# Module 1: Immoscout Session Manager

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Manage Playwright browser lifecycle for Immoscout24. Provides authenticated
browser pages to all other modules via a checkout/return pool pattern.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/session/index.ts | Module exports: getPage(), releasePage(), shutdown() |
| src/modules/session/browser-pool.ts | Browser pool: max N instances, checkout/return |
| src/modules/session/login.ts | Immoscout24 login flow via browser UI |
| src/modules/session/cookie-store.ts | Encrypt/decrypt cookies, persist to Supabase |
| src/modules/session/captcha-detector.ts | CAPTCHA detection, circuit breaker trigger |

## Inputs

- Encrypted Immoscout cookies from Supabase `users.immoscout_cookies_encrypted`
- Encrypted password from Supabase `users.immoscout_password_encrypted`
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
- **CAPTCHA detected:** Screenshot evidence → circuit breaker OPEN → Telegram
  alert → pause all jobs for user → wait for manual /resume
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

None yet.
