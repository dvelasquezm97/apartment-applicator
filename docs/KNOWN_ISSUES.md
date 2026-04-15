# Known Issues

> Last updated: 2026-04-15
> Status: ACTIVE

Check this file before touching any area marked as broken.

---

## [2026-04-15] CSS selectors need live verification

**Modules affected:** M3 (Auto-Apply), M4 (Inbox Monitor)
**Severity:** Medium — blocks real-world usage
**Details:** All Immoscout24 CSS selectors in `src/modules/auto-apply/selectors.ts` and
`src/modules/inbox-monitor/selectors.ts` are based on known patterns but have not been
verified against the live site. Selectors include multiple fallback variants for resilience,
but some may need tuning after the first real run.
**Workaround:** Run with `HEADLESS=false` to visually verify selector matches. Screenshots
are taken on failure and uploaded to the `application-screenshots` Supabase bucket.

---

## [2026-04-15] API routes have no authentication

**Modules affected:** Phase A (API + Dashboard)
**Severity:** Low — development only
**Details:** All `/api/*` routes are open. The `getUserId()` helper reads `X-User-Id` header
or defaults to `dev-user`. This is intentional for development but must be replaced with
Supabase Auth JWT verification before any public deployment.
**Workaround:** Only run the API server locally or behind a firewall.
