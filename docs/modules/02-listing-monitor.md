# Module 2: Listing Monitor

> Last updated: 2026-04-16
> Status: COMPLETE (selectors verified against live Immoscout HybridView)

## Purpose

Scrape Immoscout24 search results via browser, discover new listings,
deduplicate against existing DB records, and enqueue apply jobs for new matches.
Uses direct search URL scraping (not saved searches page).

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/listing-monitor/index.ts | Module exports |
| src/modules/listing-monitor/scraper.ts | Navigate saved searches, extract listing data |
| src/modules/listing-monitor/dedup.ts | Check immoscout_id uniqueness against DB |
| src/modules/listing-monitor/filter.ts | Daily cap check, blackout window (02:00–06:00 Berlin) |
| src/workers/listing-monitor.worker.ts | BullMQ worker: repeatable job handler |

## Immoscout HybridView Selectors (verified 2026-04-16)

Immoscout redesigned their search results to "HybridView" layout. All old selectors were dead.

| Element | Selector | Notes |
|---------|----------|-------|
| Listing card | `.listing-card:not(.touchpoint-card)` | Excludes ad/promo cards |
| Listing link | `a[href*="exposeId="]` | Uses query param, not `/expose/` path |
| Already applied | `.shortlist-star[aria-label="vom Merkzettel entfernen"]` | Red heart icon |
| Title | `[data-testid="headline"]` | — |
| Address | `[data-testid="hybridViewAddress"]` | — |
| Attributes | `[data-testid="attributes"]` | Rent, size, rooms |
| Pagination next | `[data-testid="pagination-button-next"]` | Multi-page support |

## Inputs

- Authenticated browser page from Module 1
- User's search URL (stored directly, not via saved searches page)
- User's `daily_application_count` and `daily_application_reset_at`

## Outputs

- New `bk_listings` rows in Supabase
- `auto-apply` jobs enqueued in BullMQ (one per new listing)
- Updated `daily_application_count` on user
- `ScrapedListing` objects with `alreadyApplied` boolean (skips re-application)

## Dependencies

- Module 1 (Session Manager) — for authenticated browser pages

## Key Functions

```typescript
// Scrape search URL results and return new listings (with pagination)
scrapeSearchUrl(page: Page, searchUrl: string): Promise<ScrapedListing[]>

// Check if listing already exists in DB
isDuplicate(immoscoutId: string): Promise<boolean>

// Check daily cap and blackout window
canApply(userId: string): Promise<boolean>
```

## Error Handling

- **No listings found on search URL:** Log warning, skip cycle, Telegram notification
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

- Inbox selectors (M4) still need verification against live Immoscout — M2 search selectors are verified.
