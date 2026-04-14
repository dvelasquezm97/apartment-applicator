# CTO Technical Plan: BerlinKeys M2 Listing Monitor

**Date:** 2026-04-15
**Depends on:** M1 Session Manager (COMPLETE)
**COO verdict:** GO (Aucto-level, applies to all BerlinKeys modules)

## Technical Overview

M2 is the first BullMQ worker module. It runs as a repeatable job (~8min interval), uses M1 to get an authenticated browser page, scrapes Immoscout24 saved searches, deduplicates against the DB, filters by daily cap and blackout window, and enqueues auto-apply jobs for new listings. This is the discovery pipeline — everything after M2 is triggered by listings it finds.

## Existing Code to Reuse (DO NOT rebuild)

| File | What it provides |
|------|-----------------|
| `src/modules/session/index.ts` | `getPage(userId)`, `releasePage(userId)` — M1, tested |
| `src/lib/queue.ts` | `listingMonitorQueue`, `autoApplyQueue` — configured BullMQ queues |
| `src/lib/redis.ts` | `createRedisConnection()` — BullMQ connection |
| `src/lib/supabase.ts` | `supabaseAdmin` — DB queries |
| `src/lib/logger.ts` | `createChildLogger()` |
| `src/lib/circuit-breaker.ts` | `CircuitBreaker` class |
| `src/config/constants.ts` | `DELAYS`, `JITTER_FACTOR`, `QUEUES` |
| `src/config/env.ts` | `POLL_INTERVAL_MS`, `DAILY_APPLICATION_CAP`, `APPLY_BLACKOUT_START/END` |
| `src/types/listing.ts` | `Listing` interface |
| `src/types/queue.ts` | `ListingMonitorJobData`, `AutoApplyJobData` |
| `tests/fixtures/listing.ts` | `sampleListing`, `sampleListings` |

## Files to Implement (stubs → real code)

| File | What to build |
|------|--------------|
| `src/modules/listing-monitor/dedup.ts` | Query Supabase for existing `immoscout_id`, return boolean |
| `src/modules/listing-monitor/filter.ts` | Check daily cap against `users.daily_application_count` + blackout window (02:00–06:00 Berlin time) |
| `src/modules/listing-monitor/scraper.ts` | Navigate saved searches page, extract listing cards (title, address, rent, size, rooms, immoscout_id, URL), return array of new listings |
| `src/modules/listing-monitor/index.ts` | Orchestrator: get page → scrape → dedup → filter → insert listings → enqueue auto-apply jobs → release page |
| `src/workers/listing-monitor.worker.ts` | BullMQ worker: call index.ts orchestrator, handle errors, update job progress |

## Files to Modify

None — all infrastructure exists. We only implement stubs.

## Data Model Changes

None — `listings` table exists from migration 00003. `users.daily_application_count` exists from migration 00001.

## Implementation Order

1. **dedup.ts** — Simplest. One Supabase query. Can test independently.
2. **filter.ts** — Daily cap + blackout. Pure logic + one Supabase query. Independent.
3. **scraper.ts** — Browser automation. Depends on M1 for page but can mock in tests. This is the hardest — needs real Immoscout selectors.
4. **index.ts** — Orchestrator. Wires dedup + filter + scraper + queue. Depends on all above.
5. **listing-monitor.worker.ts** — BullMQ wrapper. Calls index.ts. Last.

## Test Strategy

| Test | Type | What it verifies |
|------|------|-----------------|
| isDuplicate — known ID | Unit (mocked Supabase) | Returns true when listing exists |
| isDuplicate — new ID | Unit (mocked Supabase) | Returns false when listing doesn't exist |
| canApply — under cap | Unit (mocked Supabase) | Returns true when count < cap |
| canApply — at cap | Unit (mocked Supabase) | Returns false when count >= cap |
| canApply — resets daily | Unit (mocked Supabase) | Resets count when reset_at is past |
| isBlackoutHour — inside | Unit | Returns true at 03:00 Berlin |
| isBlackoutHour — outside | Unit | Returns false at 10:00 Berlin |
| scraper — extracts listings | Unit (mocked page with HTML fixture) | Parses listing cards correctly |
| scraper — no results | Unit (mocked page) | Returns empty array |
| orchestrator — full flow | Integration (all mocked) | Scrape → dedup → filter → insert → enqueue |

## Agent Assignments

### Builder (Claude) — direct
- **Task:** Implement all 5 files in order above
- **Focus:** Use M1's `getPage`/`releasePage` pattern. Human simulation delays from constants.ts. Immoscout selector discovery (document in BROWSER_AUTOMATION.md).
- **Depends on:** M1 complete (it is)
- **Acceptance:** All functions work, typecheck passes, tests pass

### Codex Reviewer — pre-commit hook (automatic)
- **Task:** Review every commit
- **Focus:** Scraping resilience (selectors may change), dedup correctness (no double-applications), queue job data integrity, daily cap enforcement
- **Depends on:** Each commit from Builder
- **Acceptance:** No P1 findings

### Staff Engineer — `/review`
- **Task:** Pre-ship review of full M2 diff
- **Focus:** Race conditions in worker concurrency, proper page release on errors (no leaked browser contexts), jitter implementation correctness
- **Depends on:** Builder completes implementation
- **Acceptance:** PASS

### Release Engineer — `/ship`
- **Task:** Create PR for M2
- **Depends on:** Review passes
- **Acceptance:** PR created, tests pass

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Immoscout changes saved searches page | Selectors are constants at top of scraper.ts, easy to update. Log HTML on parse failure for debugging. |
| Duplicate applications | Dedup checks immoscout_id in DB before enqueuing. Even if dedup fails, M3 (auto-apply) will detect "already applied" on the listing page. |
| Rate limiting by Immoscout | Human simulation delays between page navigations. Jitter on poll interval. CAPTCHA detection from M1. |
| Daily cap bypass | Filter checks cap BEFORE enqueuing each job, not just at start of cycle. |

## Build Order

```
1. Builder implements dedup.ts + tests           → Codex reviews commit
2. Builder implements filter.ts + tests           → Codex reviews commit
3. Builder implements scraper.ts + tests          → Codex reviews commit
4. Builder implements index.ts + integration test → Codex reviews commit
5. Builder implements worker.ts                   → Codex reviews commit
6. Staff Engineer runs /review
7. Release Engineer runs /ship → PR
```

## Paperclip

Create issues under BerlinKeys company (`54d33ea4-3d75-4ed3-8729-91125c67304f`) with `projectId` set.
