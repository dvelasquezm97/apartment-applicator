# Module 8: Manual Form Upload

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Allow users to upload a form (PDF or URL) via the web dashboard after a
viewing, then auto-fill it using the same logic as Module 7.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/manual-form-upload/index.ts | Module exports |
| src/modules/manual-form-upload/handler.ts | Handle dashboard upload, trigger auto-fill |
| src/api/documents.ts | Upload endpoint (shared) |

## Inputs

- Form PDF or URL uploaded by user via dashboard
- User profile data for auto-fill
- Application context (which listing/application this form is for)

## Outputs

- Form auto-filled (reuses Module 7 analyzer + filler)
- If URL: form submitted via Playwright
- If PDF: filled PDF returned for user download (stretch goal)
- Pending questions via Telegram for unknown fields

## Dependencies

- Module 7 (External Form) — reuses analyzer.ts and filler.ts

## Key Functions

```typescript
// Handle manual form upload from dashboard
handleFormUpload(userId: string, applicationId: string, formInput: FormInput): Promise<void>
```

## Error Handling

- Same as Module 7 for the auto-fill portion
- **Invalid PDF:** Return error to dashboard with clear message
- **URL unreachable:** Return error to dashboard

## Queue Config

- No dedicated queue — user-triggered via API endpoint
- May enqueue to `external-form` queue for consistency

## Testing

- Integration test: upload endpoint accepts PDF and URL
- Reuses Module 7 tests for auto-fill logic

## Open Issues

None yet.
