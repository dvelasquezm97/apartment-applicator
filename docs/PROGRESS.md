# Progress

> Last updated: 2026-04-16
> Status: ACTIVE

## Session: 2026-04-14 — Project Scaffold

### What was done
- Evaluated gstack starter kit → SKIP (not a scaffold, it's a Claude Code skill pack)
- Decided on two-process deployment model (API + Worker)
- Decided on playwright-core + playwright-extra (not full playwright)
- Decided on snake_case for DB columns, camelCase for TypeScript
- Created full docs/ structure with initial content (23 files)
- Created .claude/commands/ session rituals (3 files)
- Created project scaffold with all modules stubbed
- Created Supabase migration SQL
- Created test scaffold

### Decisions made
- See docs/DECISIONS.md for all 4 decisions logged this session

### Current blockers
- None

### What to build next
- Module 1: Immoscout Session Manager (browser pool, login, cookie persistence)
- Need actual Immoscout account credentials to test login flow
- Need Supabase project created and migrations run

## Session: 2026-04-15 — M3 Auto-Apply

### What was done
- Implemented M3 Auto-Apply module (7 files, ~650 lines)
- Created centralized selector registry (selectors.ts) for Immoscout listing/form pages
- Created shared human simulation utilities (human-delay.ts)
- Implemented navigator.ts: listing navigation, availability detection, apply button click
- Implemented form-filler.ts: profile-to-form mapping, German cover letter composition
- Implemented submitter.ts: document download via signed URLs, upload, submit, result detection
- Implemented index.ts orchestrator: full pipeline with state machine integration
- Implemented auto-apply.worker.ts: BullMQ worker with retry logic, CAPTCHA pause, automation_paused check
- Added 3 unit test files + 1 integration test (all passing, 99 total tests)
- Updated BROWSER_AUTOMATION.md with listing page and application form selectors
- Created CTO plan and Paperclip issues for M3

### Decisions made
- CSS selectors centralized in one file for easy maintenance when Immoscout changes layout
- Human simulation extracted to shared utility (reusable by future modules)
- Documents downloaded to temp dir via signed URLs, cleaned up immediately after upload
- Conservative success detection: if no error after submit, assume APPLIED
- Screenshots taken on failure for debugging (uploaded to application-screenshots bucket)

### Current blockers
- CSS selectors need verification against live Immoscout24

### What to build next
- Module 4: Inbox Monitor (message detection, parsing landlord responses)

## Session: 2026-04-15 — M4 Inbox Monitor

### What was done
- Implemented M4 Inbox Monitor module (6 files, ~550 lines)
- Created inbox selectors registry (selectors.ts) for Immoscout messaging pages
- Implemented reader.ts: inbox navigation, thread scraping, message extraction, application matching
- Implemented classifier.ts: two-tier classification (rule-based patterns + Claude Sonnet API fallback with structured tool_use)
- Implemented router.ts: route classified messages to downstream queues (M5/M6/M7) + state machine transitions
- Implemented index.ts orchestrator: full pipeline with page release guarantee
- Implemented worker with automation pause check and CAPTCHA handling
- Added 3 test files: classifier unit tests (11 tests), reader unit tests (3 tests), integration test (5 tests)

### Decisions made
- Rule-based classifier handles German keywords for Unterlagen, Besichtigung, Absage, etc. — should catch >80% of messages
- Claude Sonnet API fallback only fires for ambiguous messages (confidence < 0.7)
- Messages matched to applications via immoscout_id extracted from thread listing links
- Rejection messages auto-close the application

### Current blockers
- Inbox selectors need verification against live Immoscout24
- ANTHROPIC_API_KEY env var needed for Claude fallback

### What to build next
- Module 5: Document Sender (auto-send documents on DOCUMENT_REQUEST)

## Session: 2026-04-15 — Phase A: API + Dashboard

### What was done
- CTO audit of full project state — identified API + Dashboard as critical path to testable UI
- Implemented Fastify server plugins: CORS, multipart upload (10MB), rate limiting, static file serving
- Implemented 7 API route files: settings (credentials + profile + pause), documents (upload/list/delete/signed URLs), applications (list with listings, detail with timeline, messages), listings, stats, health (real Redis + Supabase checks)
- Implemented frontend data layer: API client with file upload support, 9 React Query hooks
- Built 4 dashboard pages: Dashboard (stats cards, automation status), Applications (expandable list with timeline + messages), Documents (upload with type selection, list, delete), Settings (Immoscout credentials, profile form, pause/resume toggle)
- Removed login/auth — all routes open for dev testing
- Updated App.tsx to skip login page, route directly to dashboard
- Created Paperclip project for Phase A with 12 subtask issues
- Fixed Paperclip issue update endpoint (was using wrong route — documented in memory)

### Decisions made
- Skip auth for now — all API routes are open, using X-User-Id header for dev
- Settings GET never exposes passwords — only masked values
- Supabase Auth planned for later (magic link or email/password)
- API routes use service role key (same as workers) — RLS enforcement deferred to auth phase

### Current blockers
- Need Supabase project created and migrations applied to test API routes
- Need Redis running for health checks and workers
- Need .env file with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL, ENCRYPTION_KEY
- CSS selectors for M3 and M4 need verification against live Immoscout24

### What to build next
- Set up Supabase project + run migrations + create .env
- Test dashboard end-to-end with real data
- Add auth (Supabase Auth) when ready for multi-user
- Module 5: Document Sender (reply to inbox thread with user documents)
- Module 6: Appointment Handler (parse viewing invite, create Google Calendar event)
- Module 9: Telegram Bot (notifications + /pause /resume /status commands)

## Session: 2026-04-16 — Infrastructure + Live Selector Verification

### What was done
- Created Supabase project "pacific" (mxovgbinhedtpnczrciy) on personal account, West EU Ireland
- All DB tables prefixed with `bk_` (shared Supabase project) — 10 migration files rewritten
- New migration 00011_dev_seed.sql — drops auth.users FK, inserts dev user UUID `00000000-0000-0000-0000-000000000001`
- Redis via `brew install redis` on localhost:6379
- .env file created (gitignored) with all credentials
- Supabase config.toml fixed (removed deprecated [project] section)
- Login URL changed to SSO: `https://sso.immobilienscout24.de/sso/login?appName=is24main`
- Two-step SSO flow implemented: email first, submit, password page, submit
- Added cookie consent dismissal ("Alle akzeptieren")
- Added GeeTest CAPTCHA detection (Immoscout's image puzzle)
- Added `waitForManualCaptchaSolve()` — pauses up to 2 min for user to solve CAPTCHA
- Created `scripts/manual-login.ts` for manual login + cookie save
- All M2 and M3 selectors verified via Arc browser CDP against live Immoscout24
- Immoscout redesigned to "HybridView" layout — all old selectors replaced
- M2 scraper new selectors: `.listing-card`, `a[href*="exposeId="]`, `[data-testid="headline"]`, etc.
- New `scrapeSearchUrl()` function for direct URL scraping + pagination
- `ScrapedListing` now has `alreadyApplied` boolean
- M3 auto-apply new selectors: modal contact form, separate address fields, extra questions handler
- All Supabase table references updated from `users` to `bk_users`, etc. across 16+ source files
- Env validation now makes TELEGRAM_BOT_TOKEN, GOOGLE_CLIENT_ID/SECRET, ANTHROPIC_API_KEY optional
- Dev user ID changed from `'dev-user'` to `'00000000-0000-0000-0000-000000000001'` in all API routes
- UserProfile type extended with street, houseNumber, zipCode, city, numberOfPersons
- CAPTCHA detector enhanced with GeeTest selectors + body text detection
- 117 tests passing, typecheck clean

### Decisions made
1. Use `bk_` prefix for all DB tables (shared Supabase project)
2. Skip auth for pilot — use dev user UUID, no Supabase Auth
3. Manual-assist login approach (CAPTCHA too aggressive for full automation)
4. Arc browser CDP connection for real browser testing (no CAPTCHA issues)
5. Store search URL directly instead of relying on saved searches page
6. Stop building M5-M9 until pilot validates M1-M4 core loop

### Current blockers
- Immoscout CAPTCHA blocks Playwright stealth browser — must use manual login + cookie restore
- Login requires Arc/real browser CDP or manual-login.ts for cookie capture

### What to build next
- End-to-end pilot test of M1-M4 core loop with real listings
- Validate apply flow against live Immoscout with real account
- Only after pilot success: M5 Document Sender, M6 Appointment Handler

## Session: 2026-04-16 (continued) — Chrome Extension + Dashboard Onboarding

### Phase 1: Chrome Extension + WebSocket (COMPLETE)

- Designed and implemented Chrome Manifest V3 extension for real-browser automation
- Created shared WebSocket message types (commands, events, progress updates) in `src/orchestrator/types.ts`
- Implemented Fastify WebSocket plugin (`src/api/ws.ts`): extension + dashboard connections, event routing, `waitForExtensionEvent()` promise-based listener
- Built ApplyLoop orchestrator (`src/orchestrator/apply-loop.ts`): scrape → filter → navigate → apply → record cycle with CAPTCHA pause/wait, daily cap enforcement, human-like delays (30-60s between actions)
- Added REST endpoints (`src/api/apply.ts`): POST /api/apply/start, POST /api/apply/stop, GET /api/apply/status
- Built Chrome extension (`extension/`): background.ts (WS connection, command routing), content.ts (DOM automation with verified selectors), popup.html/ts (live status + stats), manifest.json
- Added migration `00012_add_search_url.sql` — search_url and onboarding_complete columns on bk_users
- Extension sends browser notifications when CAPTCHA detected
- Orchestrator stops gracefully when extension disconnects mid-loop

### Phase 2: Dashboard Onboarding + Live Feed (COMPLETE)

- Built 4-step onboarding wizard (`web/src/pages/Onboarding.tsx`): Profile → Search URL → Install Extension → Start Applying
- Built real-time Live Feed page (`web/src/pages/LiveFeed.tsx`): applied/failed/skipped counts, status badge, scrolling results list, stop button
- Created React WebSocket hook (`web/src/hooks/useWebSocket.ts`) with auto-reconnect
- Extended API hooks (`web/src/hooks/useApi.ts`): useApplyStatus, useStartApply, useStopApply + searchUrl/onboardingComplete on Settings type
- Updated App.tsx with /onboarding and /live routes, redirect to onboarding if not complete
- Added "Live Feed" to sidebar nav in Layout.tsx
- Added search URL field to Settings page

### Decisions made
1. Chrome Extension architecture over server-side Playwright (runs in user's real browser, no CAPTCHA issues)
2. WebSocket for real-time extension <-> backend <-> dashboard communication
3. Extension popup shows live stats (applied/failed/skipped)
4. Browser notifications for CAPTCHA alerts
5. Orchestrator checks extension connection before each apply (stops if disconnected)
6. 4-step onboarding wizard for non-technical users
7. Live feed page with WebSocket-driven real-time updates

### Current blockers
- Extension must be loaded as unpacked (no Chrome Web Store listing yet)

### What to build next
- End-to-end pilot test with real listings using the extension
- M5 Document Sender, M6 Appointment Handler (after pilot validation)

## Session: 2026-04-16 (evening) — Production Deploy + Extension Keepalive Fix

### What was done

**Railway Production Deployment**
- Deployed Fastify API + Vite dashboard to Railway (berlinkeys-api-production.up.railway.app)
- Fixed Dockerfile: Tailwind/PostCSS configs, static file serving order, production WS URL
- Redis connected via Railway internal networking

**MV3 Service Worker Keepalive Fix**
- Root cause: Chrome MV3 suspends background service workers after ~30s idle, killing the WebSocket
- Fix: `chrome.alarms` keepalive fires every ~24s, sends ping on WebSocket to prevent suspension
- Server responds with pong to keep connection alive in both directions
- Added `PingEvent` to `ExtensionEvent` union type
- Manifest permissions updated: replaced `activeTab` with `tabs` + added `alarms`

**Dashboard State Fixes**
- Fixed stale "scraping" state: dashboard now resets progress to idle on WS disconnect
- Server sends real apply loop status on dashboard WS connect (not hardcoded idle)
- Exported `getApplyLoopStatus()` from apply.ts for ws.ts to query

**Fastify 400 on Bodyless POST**
- `apiFetch` was setting `Content-Type: application/json` on every request including POSTs with no body
- Fastify's JSON parser rejected the empty body — caused 400 on /apply/start and /apply/stop
- Fix: only set Content-Type header when request has a body

**LiveFeed UI Improvements**
- Added Start Applying button (was missing — only had Stop)
- Context-aware states: idle (Start button), running (status + Stop), done (summary + Run Again)
- Extension disconnected state shows instructions to connect
- Better status labels and colors

**Configuration**
- Increased MAX_PAGES from 10 to 20 (scrapes more search result pages per run)

**Server-Side Empty Body Fix**
- Added custom Fastify content type parser to accept empty JSON bodies
- Fixes the 400 from both client-side and server-side (belt and suspenders)

**Apply Loop User Feedback**
- Apply loop now broadcasts reason when exiting early (daily cap reached, no search URL, no profile)
- Previously the loop returned silently, leaving the user confused
- Daily application count was stuck at 20/20 — reset via Supabase directly
- Settings PUT endpoint does not allow resetting dailyApplicationCount (known gap)

### Decisions made
1. chrome.alarms keepalive pattern for MV3 (not offscreen document — simpler, sufficient)
2. Ping/pong heartbeat on WebSocket (keeps both service worker and connection alive)
3. Dashboard resets state on disconnect (prevents stale UI after apply loop crash)
4. 20 pages of search results per run (was 10)
5. Server-side empty body parser (don't rely on client fix alone for Fastify JSON requirement)

### Current blockers
- Extension must be loaded as unpacked (no Chrome Web Store listing yet)
- Settings API does not expose daily count reset — must reset via Supabase directly
- Apply loop not yet tested end-to-end with real listings in production

### What to build next
- Full pilot test of apply loop with real Immoscout listings
- Add daily count reset to settings API (or auto-reset on new day)
- Monitor extension stability across long apply sessions
- M5 Document Sender, M6 Appointment Handler (after pilot validation)
