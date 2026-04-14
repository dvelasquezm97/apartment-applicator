# Module 5: Document Sender

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Reply to Immoscout24 inbox threads with the user's documents when a
document request is detected by the inbox classifier.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/document-sender/index.ts | Module exports |
| src/modules/document-sender/sender.ts | Navigate to thread, attach documents, send reply |
| src/workers/document-sender.worker.ts | BullMQ worker: process document-send jobs |

## Inputs

- Authenticated browser page from Module 1
- Application ID and thread reference from the enqueued job
- User's documents from Supabase Storage (downloaded via signed URLs)

## Outputs

- Reply sent in Immoscout inbox thread with all user documents attached
- Application status: DOCUMENTS_REQUESTED → DOCUMENTS_SENT
- Timeline entry appended
- Telegram: "Documents sent for [listing title]"
- Outbound message record in `messages` table

## Dependencies

- Module 1 (Session Manager) — browser pages
- Module 4 (Inbox Monitor) — creates the jobs this module processes

## Key Functions

```typescript
// Send documents in reply to an inbox thread
sendDocuments(page: Page, applicationId: string, userId: string): Promise<void>

// Download all user documents from Supabase Storage
downloadUserDocuments(userId: string): Promise<Buffer[]>
```

## Error Handling

- **Thread not found:** Mark FAILED, Telegram alert
- **Document upload failed:** Retry once, then mark FAILED, alert
- **No documents uploaded by user:** Telegram alert asking user to upload docs, skip

## Queue Config

- Queue: `document-sender`
- Type: Event-driven (enqueued by inbox-monitor)
- Concurrency: 1
- Per-user isolation: `user:{userId}:document-sender`
- Retry: 3 attempts, exponential backoff

## Testing

- Integration test: mock browser send flow
- Unit test: document download from Supabase Storage mock

## Open Issues

None yet.
