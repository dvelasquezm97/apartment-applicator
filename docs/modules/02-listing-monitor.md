# Module 2: Listing Monitor

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Periodically scrape Immoscout24 saved searches via browser, discover new
listings, deduplicate against existing DB records, and enqueue apply jobs
for new matches.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/listing-monitor/index.ts | Module exports |
| src/modules/listing-monitor/scraper.ts | Navigate saved searches, extract listing data |
| src/modules/listing-monitor/dedup.ts | Check immoscout_id uniqueness against DB |
| src/modules/listing-monitor/filter.ts | Daily cap check, blackout window (02:00–06:00 Berlin) |
| src/workers/listing-monitor.worker.ts | BullMQ worker: repeatable job handler |

## Inputs

- Authenticated browser page from Module 1
- Saved searches page on Immoscout24
- User's `daily_application_count` and `daily_application_reset_at`

## Outputs

- New `listings` rows in Supabase
- `auto-apply` jobs enqueued in BullMQ (one per new listing)
- Updated `daily_application_count` on user

## Dependencies

- Module 1 (Session Manager) — for authenticated browser pages

## Key Functions

```typescript
// Scrape saved searches and return new listings
scrapeNewListings(page: Page, userId: string): Promise<Listing[]>

// Check if listing already exists in DB
isDuplicate(immoscoutId: string): Promise<boolean>

// Check daily cap and blackout window
canApply(userId: string): Promise<boolean>
```

## Error Handling

- **No saved searches found:** Log warning, skip cycle, Telegram notification
- **Page structure changed:** Log scraped HTML for debugging, skip cycle, alert
- **Scrape timeout (30s):** Retry once, then skip cycle
- **Daily cap reached:** Skip remaining listings, log, Telegram: "Daily cap reached (X/Y)"

## Queue Config

- Queue: `listing-monitor`
- Type: Repeatable
- Interval: ~8 minutes (POLL_INTERVAL_MS env var) ±20% jitter
- Concurrency: 1
- Per-user isolation: `user:{userId}:listing-monitor`

## Testing

- Unit test: deduplication logic with known/unknown immoscout_ids
- Unit test: blackout window check at various Berlin times
- Unit test: daily cap enforcement
- Integration test: scraper with saved HTML fixture

## Open Issues

None yet.
