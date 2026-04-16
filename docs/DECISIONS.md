# Architectural Decisions

> Last updated: 2026-04-16
> Status: ACTIVE

Append-only log. Never delete entries — strike through if reversed.

---

## [2026-04-14] Decision: Skip gstack as project starter kit

**Options considered:**
- A) Use gstack (https://github.com/garrytan/gstack) as project scaffold
- B) Build from scratch with Fastify + Supabase + BullMQ

**Chosen:** B — Build from scratch

**Rationale:** gstack is a Claude Code skill pack (~30 Markdown slash commands for
AI-assisted development workflow: plan, review, QA, ship). It also ships a headless
Chromium daemon for browser-based QA. It is NOT a project starter kit, scaffold, or
application framework. It provides no app boilerplate, no project structure, no library
integrations, and no runtime dependencies. Zero overlap with our stack requirements
(Fastify, Supabase, BullMQ, Playwright+stealth, grammy.js, googleapis). Building from
scratch gives us full control over the architecture without unnecessary abstractions.

---

## [2026-04-14] Decision: Two-process deployment model

**Options considered:**
- A) Single process running API server + workers
- B) Two separate processes: API (Fastify + Telegram bot) and Worker (BullMQ workers)
- C) Microservices per module

**Chosen:** B — Two processes

**Rationale:** Separation of concerns without microservice overhead. API process handles
HTTP requests and Telegram webhook — lightweight, fast restarts. Worker process runs
BullMQ job handlers and Playwright browser pool — memory-intensive, independent scaling.
Both share the same Redis and Supabase. On Railway, these are two services from the same
repo with different start commands. If the worker crashes (e.g., Playwright OOM), the API
and Telegram bot remain available.

---

## [2026-04-14] Decision: playwright-core + playwright-extra (not full playwright)

**Options considered:**
- A) Full `playwright` package (includes all browser binaries)
- B) `playwright-core` + `playwright-extra` + separate Chromium install

**Chosen:** B — playwright-core + playwright-extra

**Rationale:** Full playwright package bundles Chromium, Firefox, and WebKit (~400MB+).
We only need Chromium. Using playwright-core + explicit `npx playwright install chromium`
saves ~300MB RAM on Railway. playwright-extra wraps playwright-core and enables the
puppeteer-extra-plugin-stealth for anti-bot evasion.

---

## [2026-04-14] Decision: Column naming convention — snake_case

**Options considered:**
- A) camelCase (matches TypeScript)
- B) snake_case (PostgreSQL convention)

**Chosen:** B — snake_case in database, camelCase in TypeScript

**Rationale:** PostgreSQL folds unquoted identifiers to lowercase. snake_case is the
standard convention and avoids quoting issues. TypeScript types use camelCase. Conversion
happens at the Supabase client boundary.

---

## [2026-04-15] Decision: Centralized CSS selectors per module

**Options considered:**
- A) Inline selectors in each function
- B) Centralized selectors.ts file per module

**Chosen:** B — Centralized selectors.ts

**Rationale:** Immoscout can change their HTML at any time. Centralizing all CSS selectors
in a single file per module (auto-apply/selectors.ts, inbox-monitor/selectors.ts) means
selector updates only require changing one file. Each selector has multiple fallback variants
(data-qa attributes, class names, text content) for resilience.

---

## [2026-04-15] Decision: Two-tier message classification (rules + Claude API)

**Options considered:**
- A) Claude API for all message classification
- B) Rule-based only (keyword matching)
- C) Rule-based first, Claude API fallback for ambiguous messages

**Chosen:** C — Two-tier: rules first, Claude Sonnet fallback

**Rationale:** Rule-based classification is free and fast — handles >80% of messages
(German keywords for Unterlagen, Besichtigung, Absage, etc.). Claude Sonnet API is only
called when rule confidence is below 0.7, keeping API costs low. Structured tool_use
output ensures reliable intent extraction from Claude.

---

## [2026-04-15] Decision: Skip auth for Phase A dashboard

**Options considered:**
- A) Implement Supabase Auth before dashboard
- B) Ship dashboard without auth, add later

**Chosen:** B — No auth for now

**Rationale:** Getting to a testable UI is the priority. Auth adds complexity (JWT
middleware, login page, session management) that blocks testing. All API routes are open
with a dev-mode X-User-Id header. Supabase Auth will be added when moving to multi-user
or production.

---

## [2026-04-16] Decision: Use `bk_` prefix for all DB tables

**Options considered:**
- A) Standard table names (users, listings, applications, etc.)
- B) Prefixed table names with `bk_` (bk_users, bk_listings, bk_applications, etc.)

**Chosen:** B — `bk_` prefix

**Rationale:** Supabase project "pacific" is a shared project on the personal account. The
`bk_` prefix avoids collisions with other products that may share the same Supabase project.
All 10 migration files rewritten. All source code references updated across 16+ files.

---

## [2026-04-16] Decision: Skip auth for pilot — use dev user UUID

**Options considered:**
- A) Implement Supabase Auth before pilot testing
- B) Use a fixed dev user UUID (`00000000-0000-0000-0000-000000000001`) with no auth

**Chosen:** B — Fixed dev user UUID

**Rationale:** Migration 00011_dev_seed.sql drops the auth.users FK constraint and inserts
a dev user directly. This lets the entire M1-M4 pipeline run without any Supabase Auth
setup. Auth will be added when the pilot is validated and multi-user is needed.

---

## [2026-04-16] Decision: Manual-assist login approach

**Options considered:**
- A) Full Playwright stealth automated login
- B) 2captcha or anti-captcha service integration
- C) Manual-assist: user logs in via real browser, cookies saved and restored

**Chosen:** C — Manual-assist login

**Rationale:** Immoscout24 deploys GeeTest image puzzle CAPTCHA on their SSO login. Even
with stealth plugin, CAPTCHA triggers on every headless login attempt. CAPTCHA solving
services add cost, latency, and reliability concerns. Manual login is a one-time event
(cookies persist for days/weeks), so the UX cost is minimal. Created
`scripts/manual-login.ts` and `waitForManualCaptchaSolve()` (2 min timeout) for the flow.

---

## [2026-04-16] Decision: Arc browser CDP for real browser testing

**Options considered:**
- A) Only use Playwright headless for all browser tasks
- B) Connect to Arc browser via Chrome DevTools Protocol for testing

**Chosen:** B — Arc CDP connection

**Rationale:** Arc browser already has a logged-in Immoscout session with valid cookies.
Connecting via CDP avoids CAPTCHA entirely and allows live testing of M2/M3 selectors
against the real site. Used for the full selector verification session that confirmed
Immoscout's "HybridView" redesign.

---

## [2026-04-16] Decision: Store search URL directly instead of saved searches page

**Options considered:**
- A) Navigate to Immoscout saved searches page, then scrape each saved search
- B) Store user's search URL directly, scrape results from that URL

**Chosen:** B — Direct search URL

**Rationale:** Immoscout's saved searches page requires extra navigation and its own set
of selectors. Storing the user's search URL (e.g., a filtered search for Berlin apartments)
and scraping results directly is simpler, faster, and more reliable. Added
`scrapeSearchUrl()` function with pagination support.

---

## [2026-04-16] Decision: Pause M5-M9 until pilot validates core loop

**Options considered:**
- A) Continue building M5-M9 in sequence
- B) Stop building new modules, focus on pilot testing M1-M4

**Chosen:** B — Pause new module development

**Rationale:** M1-M4 form the core automation loop (login, find listings, apply, monitor
inbox). Building M5-M9 without validating this loop risks building on wrong assumptions
(selectors, flows, timing). The pilot will test with real listings and a real account.
Resume M5-M9 only after pilot success.
