# CTO Technical Plan: BerlinKeys M4 Inbox Monitor

**Date:** 2026-04-15
**Module spec:** docs/modules/04-inbox-monitor.md
**Paperclip project:** M4 Inbox Monitor (b201f1ca)

## Technical Overview

M4 periodically scrapes the Immoscout24 inbox via browser, parses inbound messages per thread, classifies intent (document request, viewing invite, external form, rejection, generic), and routes to downstream handler queues (M5/M6/M7). Uses a two-tier classification: fast rule-based pattern matching first, Claude Sonnet API fallback for ambiguous messages. Integrates M1 for authenticated pages and the state machine for application status transitions.

## Files to Create

| File | Description |
|------|-------------|
| `src/modules/inbox-monitor/selectors.ts` | CSS selector registry for Immoscout inbox pages |
| `src/modules/inbox-monitor/router.ts` | Route classified messages to downstream queues + update state machine |
| `tests/unit/classifier.test.ts` | Replace TODO stubs with real tests for rule-based + API classification |
| `tests/unit/reader.test.ts` | Unit tests for inbox scraping and message extraction |
| `tests/integration/inbox-monitor.test.ts` | Full pipeline: read → classify → route with mocks |

## Files to Modify

| File | Changes |
|------|---------|
| `src/modules/inbox-monitor/index.ts` | Add `runInboxMonitor()` orchestration function |
| `src/modules/inbox-monitor/reader.ts` | Full implementation: navigate inbox, extract messages |
| `src/modules/inbox-monitor/classifier.ts` | Full implementation: rule-based + Claude API fallback |
| `src/workers/inbox-monitor.worker.ts` | Full worker with error handling |
| `docs/BROWSER_AUTOMATION.md` | Fill in "Inbox" selector section |
| `docs/MODULES.md` | Update M4 status |
| `docs/modules/04-inbox-monitor.md` | Update status |

## Data Model Changes

None — messages table and application status enum already exist.

## Implementation Order

1. `selectors.ts` — Immoscout inbox CSS selectors
2. `reader.ts` — Navigate inbox, scrape message threads, match to applications
3. `classifier.ts` — Rule-based classification + Claude Sonnet structured output fallback
4. `router.ts` — Route messages to downstream queues + state transitions
5. `index.ts` — Orchestrator: read → classify → route pipeline
6. `inbox-monitor.worker.ts` — BullMQ repeatable worker
7. Tests — unit (classifier, reader) + integration
8. Docs update

## Build Order

Builder → Codex (continuous) → Staff Engineer → Compliance → Release Engineer
