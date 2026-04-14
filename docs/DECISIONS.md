# Architectural Decisions

> Last updated: 2026-04-14
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
