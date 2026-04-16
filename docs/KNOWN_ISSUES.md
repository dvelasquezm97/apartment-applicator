# Known Issues

> Last updated: 2026-04-16
> Status: ACTIVE

Check this file before touching any area marked as broken.

---

## ~~[2026-04-15] CSS selectors need live verification~~ RESOLVED 2026-04-16

All M2 and M3 selectors verified via Arc browser CDP against live Immoscout24. Selectors
updated to match Immoscout's new "HybridView" layout. See docs/BROWSER_AUTOMATION.md.

---

## [2026-04-15] API routes have no authentication

**Modules affected:** Phase A (API + Dashboard)
**Severity:** Low — development only
**Details:** All `/api/*` routes are open. The `getUserId()` helper reads `X-User-Id` header
or defaults to `00000000-0000-0000-0000-000000000001` (dev user UUID). This is intentional
for development but must be replaced with Supabase Auth JWT verification before any public
deployment.
**Workaround:** Only run the API server locally or behind a firewall.

---

## [2026-04-16] Immoscout CAPTCHA blocks Playwright stealth browser

**Modules affected:** M1 (Session), M2 (Listing Monitor), M3 (Auto-Apply)
**Severity:** High — blocks fully automated login
**Details:** Immoscout24 uses GeeTest image puzzle CAPTCHA on their SSO login page. Even with
playwright-extra stealth plugin, the CAPTCHA is triggered on every login attempt from a
headless browser. The GeeTest CAPTCHA requires solving an image puzzle (drag to match) that
cannot be automated reliably.
**Workaround:** Use manual-assist login approach:
1. Run `npx tsx scripts/manual-login.ts` to open a real browser
2. User manually solves CAPTCHA and logs in
3. Cookies are saved to Supabase (encrypted)
4. Subsequent runs restore cookies without needing to log in again
5. Alternative: connect to Arc browser via CDP for real browser sessions

---

## [2026-04-16] Login requires Arc/real browser CDP or manual-login.ts for cookie capture

**Modules affected:** M1 (Session)
**Severity:** Medium — affects developer workflow
**Details:** Because of the CAPTCHA issue above, initial cookie capture cannot happen
through Playwright stealth. Developers must use one of two approaches:
- `scripts/manual-login.ts` — opens a visible Chromium, user logs in manually, cookies saved
- Arc browser CDP — connect to a running Arc browser session where user is already logged in
**Workaround:** Once cookies are captured and stored in Supabase, they persist across
sessions. Only need to re-capture when cookies expire (typically days to weeks).
**Note:** The Chrome extension bypasses this issue entirely — it runs in the user's real
browser where they are already logged in to Immoscout.

---

## [2026-04-16] Extension must be loaded as unpacked (no Chrome Web Store listing)

**Modules affected:** M10 (Dashboard), Chrome Extension
**Severity:** Medium — affects distribution to non-technical users
**Details:** The Chrome extension is not published on the Chrome Web Store. Users must
load it as an unpacked extension via `chrome://extensions` with Developer Mode enabled.
This requires enabling Developer Mode and navigating to the `extension/` directory.
**Workaround:** Provide step-by-step instructions in the onboarding wizard (Step 3).
Chrome Web Store listing planned for future release.

---

## [2026-04-16] Dashboard WebSocket URL hardcoded to localhost

**Modules affected:** M10 (Dashboard), Chrome Extension
**Severity:** Medium — blocks production deployment
**Details:** The WebSocket connection URL in `web/src/hooks/useWebSocket.ts` and in
the extension's `background.ts` is hardcoded to `ws://localhost:3000/ws`. This works
for local development but will not work in production.
**Workaround:** For local dev, no action needed. For production, the WS URL must be
made configurable via environment variable (Vite's `import.meta.env`) and the extension's
storage settings.
