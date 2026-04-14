# BerlinKeys — Automated Apartment Application System for Immoscout24

> Status: SCAFFOLD COMPLETE — All modules stubbed, no implementation yet
> Last updated: 2026-04-14

## Quick Commands
- `npm run dev` — Start Fastify API server (dev)
- `npm run dev:worker` — Start BullMQ workers (dev)
- `npm run dev:web` — Start Vite dashboard (dev)
- `npm test` — Run vitest
- `npm run typecheck` — TypeScript check
- Deploy: see docs/DEPLOYMENT.md

## Documentation Index
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System diagram, data flow, queue topology, circuit breaker
- [docs/STACK.md](docs/STACK.md) — Stack decisions with rationale
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — Supabase tables, RLS, state machine transitions
- [docs/MODULES.md](docs/MODULES.md) — 10-module status table
- [docs/BROWSER_AUTOMATION.md](docs/BROWSER_AUTOMATION.md) — Playwright stealth, cookies, selectors
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — Telegram, Google Calendar, Supabase, Claude API
- [docs/SECURITY.md](docs/SECURITY.md) — Encryption, RLS, env vars, operational security
- [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) — Retry, DLQ, circuit breaker, reconciliation
- [docs/TESTING.md](docs/TESTING.md) — Test strategy and fixtures
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Supabase + Railway + OAuth setup
- [docs/DECISIONS.md](docs/DECISIONS.md) — Append-only architectural decision log
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — Active bugs and workarounds
- [docs/PROGRESS.md](docs/PROGRESS.md) — Session log and next steps
- [docs/modules/](docs/modules/) — Per-module micro-context (01-session through 10-dashboard)

## Module Status (all NOT_STARTED)
M1 Session | M2 Listing Monitor | M3 Auto-Apply | M4 Inbox Monitor | M5 Doc Sender
M6 Appointment | M7 External Form | M8 Manual Form | M9 Telegram | M10 Dashboard

## Session Rituals
- Start: `/start-session` — reads context, asks which module to work on
- End: `/end-session` — updates PROGRESS.md, MODULES.md, changed docs
- Status: `/module-status` — prints module status table
