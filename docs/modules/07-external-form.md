# Module 7: External Form Auto-Fill

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Detect external application form URLs in inbox messages, open them in
Playwright, use Claude API to analyze form fields, auto-fill from user
profile, ask the user via Telegram for any unknown fields, and submit.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/external-form/index.ts | Module exports |
| src/modules/external-form/detector.ts | Extract form URLs from message content |
| src/modules/external-form/analyzer.ts | Claude API: analyze form HTML → field schema |
| src/modules/external-form/filler.ts | Fill fields, handle pending questions, submit |
| src/workers/external-form.worker.ts | BullMQ worker: process external form jobs |

## Inputs

- Message content with form URL (from inbox-monitor)
- Authenticated browser (new context — separate from Immoscout session)
- User profile data for auto-fill
- User answers to pending questions (from Telegram via bot_sessions)

## Outputs

- Form submitted successfully
- Screenshot of confirmation page stored in Supabase Storage
- Application status transitions:
  - EXTERNAL_FORM_DETECTED → EXTERNAL_FORM_FILLING → EXTERNAL_FORM_SENT
  - Or: → AWAITING_USER_INPUT (if unknown fields) → EXTERNAL_FORM_FILLING (on answer)
- `pending_questions` rows for unknown fields
- `bot_sessions` row for stateful Telegram conversation
- Telegram notifications at each step

## Dependencies

- Module 4 (Inbox Monitor) — creates the jobs this module processes

## Key Functions

```typescript
// Detect form URLs in message content
detectFormUrl(content: string): string | null

// Analyze form HTML with Claude API → structured field schema
analyzeForm(html: string, userProfile: UserProfile): Promise<FormAnalysis>

// Fill all mapped fields, return unmapped fields
fillForm(page: Page, analysis: FormAnalysis, profile: UserProfile): Promise<UnmappedField[]>

// Submit form and capture confirmation screenshot
submitForm(page: Page): Promise<Buffer>
```

## Claude API Strategy

- Model: claude-sonnet (cost-efficient for structured extraction)
- Input: form HTML (cleaned — remove scripts, styles, nav)
- Output: structured tool_use response with:
  - `fields`: array of {name, label, type, selector, mappedProfileKey?, value?}
  - `unmappedFields`: fields that need user input
- Prompt: "Analyze this HTML form. Map each field to the user profile where possible.
  Profile keys: name, dob, nationality, phone, occupation, employer, income, schufaScore..."

## Pending Question Flow

1. For each unmapped field: insert `pending_questions` row
2. Create/update `bot_sessions` row for user with `awaiting_field`, `awaiting_application_id`, `awaiting_job_id`
3. Send Telegram message: "For [listing], please answer: [field_label]?"
4. Pause BullMQ job (use job.moveToDelayed or separate resume mechanism)
5. On Telegram reply: update pending_question with answer, resume job
6. On 24h timeout: mark `timed_out_at`, skip field, resume job, Telegram notify

## Error Handling

- **Form URL inaccessible:** Mark FAILED, Telegram alert
- **Claude API timeout:** Retry once, then mark FAILED
- **Form submission fails:** Screenshot error page, mark FAILED, retry
- **Partial fill (some fields skipped):** Continue, note skipped fields in timeline

## Queue Config

- Queue: `external-form`
- Type: Event-driven (enqueued by inbox-monitor)
- Concurrency: 1
- Per-user isolation: `user:{userId}:external-form`
- Retry: 2 attempts (form state may not survive retry)

## Testing

- Unit test: URL detection from various message formats
- Unit test: form analysis output parsing
- Integration test: full fill flow with mock Playwright and Claude API
- Fixture: sample external form HTML pages

## Open Issues

None yet.
