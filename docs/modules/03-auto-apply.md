# Module 3: Auto-Apply

> Last updated: 2026-04-16
> Status: COMPLETE (selectors verified against live Immoscout HybridView)

## Purpose

Automatically apply to Immoscout24 listings via browser UI. Navigates to
listing, fills application form, uploads user documents, and submits.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/auto-apply/index.ts | Orchestrator: applyToListing() pipeline + state machine |
| src/modules/auto-apply/navigator.ts | Navigate to listing, detect availability, click apply button |
| src/modules/auto-apply/form-filler.ts | Map user profile to form fields, fill with human typing |
| src/modules/auto-apply/submitter.ts | Download docs via signed URLs, upload, submit, detect result |
| src/modules/auto-apply/selectors.ts | Centralized CSS selector registry for Immoscout pages |
| src/modules/auto-apply/human-delay.ts | Human simulation: typing, clicking, scrolling, delays |
| src/workers/auto-apply.worker.ts | BullMQ worker: process apply jobs, retry logic, CAPTCHA pause |

## Contact Form Selectors (verified 2026-04-16)

Immoscout's contact form now opens as a **modal** (`[role="dialog"]`), not an inline form.

| Element | Selector | Notes |
|---------|----------|-------|
| Nachricht button | `[data-testid="contact-message-button"]`, `[data-testid="contact-button"]` | Opens modal |
| Modal form | `[role="dialog"]` | Contains all form fields |
| Salutation | Salutation select/radio | Always "Herr" |
| Street | `input[name*="street"]` | Separate field (not combined address) |
| House number | `input[name*="houseNumber"]` | Separate field |
| Zip code | `input[name*="zipCode"]` | Separate field |
| City | `input[name*="city"]` | Separate field |
| Extra questions | Insolvency/arrears/pets/smoking | Always "Nein" |
| Profile sharing | Toggle | Always enabled |
| Submit | `button:has-text("Abschicken")` | Changed from "Senden" |
| Success | Text: "Nachricht gesendet" | Changed from "erfolgreich" |

## Inputs

- Authenticated browser page from Module 1
- Listing URL from the enqueued job
- User profile data from `bk_users.profile` JSONB (extended with street, houseNumber, zipCode, city, numberOfPersons)
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

- ~~CSS selectors need verification~~ RESOLVED 2026-04-16: All selectors verified via Arc CDP against live Immoscout HybridView.
- Extra questions handler assumes "Nein" for all — may need to be configurable per-user in future.
