# BerlinKeys — Automated Apartment Application System for Immoscout24

> Status: M1 Session Manager COMPLETE, M2 Listing Monitor COMPLETE
> Last updated: 2026-04-15
> Company: [Aucto](~/Desktop/aucto/) — Agentic-first company

## Quick Commands
- `npm run dev` — Start Fastify API server (dev)
- `npm run dev:worker` — Start BullMQ workers (dev)
- `npm run dev:web` — Start Vite dashboard (dev)
- `npm test` — Run vitest
- `npm run typecheck` — TypeScript check
- Deploy: see docs/DEPLOYMENT.md

## Documentation Index
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System diagram, data flow, queue topology
- [docs/STACK.md](docs/STACK.md) — Stack decisions with rationale
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — Supabase tables, RLS, state machine
- [docs/MODULES.md](docs/MODULES.md) — 10-module status table
- [docs/BROWSER_AUTOMATION.md](docs/BROWSER_AUTOMATION.md) — Playwright stealth, cookies, selectors
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — Telegram, Calendar, Supabase, Claude API
- [docs/SECURITY.md](docs/SECURITY.md) — Encryption, RLS, env vars
- [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) — Retry, DLQ, circuit breaker
- [docs/TESTING.md](docs/TESTING.md) — Test strategy and fixtures
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Supabase + Railway + OAuth setup
- [docs/DECISIONS.md](docs/DECISIONS.md) — Append-only decision log
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — Active bugs and workarounds
- [docs/PROGRESS.md](docs/PROGRESS.md) — Session log and next steps
- [docs/modules/](docs/modules/) — Per-module micro-context (01 through 10)
- [.agents/README.md](.agents/README.md) — Agent communication protocol
- [.claude/commands/](.claude/commands/) — Product-specific skills (start-session, end-session, module-status)
- [docs/AUCTO-OS.md](docs/AUCTO-OS.md) — How this product connects to the Aucto OS

## Module Status
M1 Session COMPLETE | M2 Listing Monitor COMPLETE | M3 Auto-Apply NOT_STARTED
M4 Inbox Monitor NOT_STARTED | M5 Doc Sender NOT_STARTED | M6 Appointment NOT_STARTED
M7 External Form NOT_STARTED | M8 Manual Form NOT_STARTED | M9 Telegram NOT_STARTED | M10 Dashboard NOT_STARTED

## Session Rituals
- Start: `/start-session` — reads context, asks which module to work on
- End: `/end-session` — updates PROGRESS.md, MODULES.md, changed docs
- Status: `/module-status` — prints module status table

## Aucto Agent Team

Company: [Aucto](~/Desktop/aucto/). Company skills at `~/.claude/commands/` (available globally).
Codex reviews ALL code via pre-commit hook. `SKIP_CODEX_REVIEW=1` to bypass.

**Skills:** `/ideate`, `/think-like-a-COO`, `/cto-plan`, `/arch-review`, `/qa-regression`, `/compliance-check`, `/safe-deploy`, `/update-docs`, `/init-product` + all gstack skills.

## Skill routing

When the user's request matches a skill, invoke it as FIRST action.

- New ideas, brainstorming → ideate | Challenge → think-like-a-coo | Tech plan → cto-plan
- Architecture → arch-review | QA, regression → qa-regression | Security → compliance-check
- Deploy → safe-deploy | Bugs → investigate | Ship, PR → ship | Code review → review
- Second opinion → codex | Update docs → update-docs | Design → design-consultation
- Retro → retro | Health check → health | Checkpoint → checkpoint
