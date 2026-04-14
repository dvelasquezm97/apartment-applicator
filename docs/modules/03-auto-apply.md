# Module 3: Auto-Apply

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Automatically apply to Immoscout24 listings via browser UI. Navigates to
listing, fills application form, uploads user documents, and submits.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/auto-apply/index.ts | Module exports |
| src/modules/auto-apply/navigator.ts | Navigate to listing, find apply button |
| src/modules/auto-apply/form-filler.ts | Fill application form fields from user profile |
| src/modules/auto-apply/submitter.ts | Upload documents, submit, verify success |
| src/workers/auto-apply.worker.ts | BullMQ worker: process apply jobs |

## Inputs

- Authenticated browser page from Module 1
- Listing URL from the enqueued job
- User profile data from `users.profile` JSONB
- User documents from Supabase Storage

## Outputs

- Application status: APPLYING → APPLIED (success) or APPLYING → FAILED (error)
- Timeline entry appended to application
- Telegram notification on success: "Applied to [title] — [address]"
- Telegram notification on failure with error details

## Dependencies

- Module 1 (Session Manager) — for authenticated browser pages
- Module 2 (Listing Monitor) — creates the jobs this module processes

## Key Functions

```typescript
// Full apply flow: navigate → fill → upload → submit
applyToListing(page: Page, listing: Listing, user: User): Promise<ApplicationResult>

// Fill the application form fields
fillApplicationForm(page: Page, profile: UserProfile): Promise<void>

// Upload documents to the application
uploadDocuments(page: Page, documents: Document[]): Promise<void>
```

## Error Handling

- **Listing no longer available:** Mark FAILED with note "listing delisted"
- **Apply button not found:** Screenshot, mark FAILED, log HTML for selector update
- **Form field not found:** Skip field, log warning, continue
- **Upload fails:** Retry once, then mark FAILED
- **Already applied:** Detect duplicate message, mark APPLIED, skip
- **Status: FAILED → retry:** Increment retry_count, re-enqueue if < 3

## Queue Config

- Queue: `auto-apply`
- Type: Event-driven (enqueued by listing-monitor)
- Concurrency: 1 (serialised to avoid detection)
- Per-user isolation: `user:{userId}:auto-apply`
- Retry: 3 attempts, exponential backoff (5s, 10s, 20s)
- Delay between applications: random 30s–120s

## Testing

- Unit test: form field mapping from user profile
- Integration test: full apply flow with mocked Playwright page
- Fixture: saved application form HTML

## Open Issues

None yet.
