# Modules

> Last updated: 2026-04-15
> Status: ACTIVE

## Status Table

| # | Module | Status | Entry Point | Dependencies | Known Issues |
|---|--------|--------|-------------|--------------|-------------|
| 1 | Session Manager | COMPLETE | src/modules/session/index.ts | — | — |
| 2 | Listing Monitor | COMPLETE | src/modules/listing-monitor/index.ts | M1 | — |
| 3 | Auto-Apply | COMPLETE | src/modules/auto-apply/index.ts | M1, M2 | Selectors need verification against live Immoscout |
| 4 | Inbox Monitor | COMPLETE | src/modules/inbox-monitor/index.ts | M1 | Inbox selectors need verification against live Immoscout |
| 5 | Document Sender | NOT_STARTED | src/modules/document-sender/index.ts | M1, M4 | — |
| 6 | Appointment Handler | NOT_STARTED | src/modules/appointment-handler/index.ts | M4 | — |
| 7 | External Form | NOT_STARTED | src/modules/external-form/index.ts | M4 | — |
| 8 | Manual Form Upload | NOT_STARTED | src/modules/manual-form-upload/index.ts | M7 | — |
| 9 | Telegram Bot | NOT_STARTED | src/modules/telegram-bot/index.ts | — | — |
| 10 | Web Dashboard | IN_PROGRESS | src/modules/dashboard/index.ts | — | API routes + React pages implemented, no auth yet |

## Status Values

- **NOT_STARTED** — No code written
- **IN_PROGRESS** — Actively being built
- **COMPLETE** — Feature-complete and tested
- **BROKEN** — Was working, now failing — see docs/KNOWN_ISSUES.md

## Build Order

Modules must be built in order 1 → 10. Each module depends on
the modules listed in the Dependencies column above being at least
IN_PROGRESS. Module 9 (Telegram) and 10 (Dashboard) can be started
in parallel with other modules as they have no module dependencies,
but they need the Supabase schema and API routes to exist.
