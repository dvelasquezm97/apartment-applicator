# Module 4: Inbox Monitor

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Periodically scrape the Immoscout24 inbox via browser, parse new inbound
messages per thread, classify intent, and route to the appropriate handler
module (document-sender, appointment-handler, or external-form).

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/inbox-monitor/index.ts | Module exports |
| src/modules/inbox-monitor/reader.ts | Navigate inbox, extract messages per thread |
| src/modules/inbox-monitor/classifier.ts | Classify message intent (rules + Claude API fallback) |
| src/workers/inbox-monitor.worker.ts | BullMQ worker: repeatable job handler |

## Inputs

- Authenticated browser page from Module 1
- Existing applications in DB (to match inbox threads to applications)

## Outputs

- New `messages` rows in Supabase
- Routed jobs enqueued based on classification:
  - DOCUMENT_REQUEST → document-sender queue
  - VIEWING_INVITE → appointment queue
  - EXTERNAL_FORM → external-form queue
  - GENERIC → log + Telegram notification only
- Application status transitions (e.g., APPLIED → DOCUMENTS_REQUESTED)

## Dependencies

- Module 1 (Session Manager) — for authenticated browser pages

## Key Functions

```typescript
// Read all unprocessed messages from inbox
readNewMessages(page: Page, userId: string): Promise<InboxMessage[]>

// Classify a message's intent
classifyMessage(message: InboxMessage): Promise<MessageIntent>

// Route a classified message to the appropriate handler queue
routeMessage(message: InboxMessage, intent: MessageIntent): Promise<void>
```

## Classification Strategy

1. **Rule-based first** (fast, no API cost):
   - Contains "Unterlagen" / "Dokumente" / "documents" → DOCUMENT_REQUEST
   - Contains "Besichtigung" / "Termin" / "viewing" → VIEWING_INVITE
   - Contains URL to known form providers → EXTERNAL_FORM
   - Contains "leider" / "absage" / "leider nicht" → REJECTION

2. **Claude API fallback** (ambiguous messages only):
   - Model: claude-sonnet (cost-efficient)
   - Structured output via tool_use for reliable classification
   - Prompt includes all intent categories with examples

## Error Handling

- **Inbox page changed:** Log HTML, skip cycle, alert
- **Message already processed:** Skip (idempotent via `processed_at` check)
- **Claude API timeout:** Default to GENERIC, flag for manual review
- **Thread can't be matched to application:** Create orphan message, Telegram alert

## Queue Config

- Queue: `inbox-monitor`
- Type: Repeatable
- Interval: ~5 minutes ±20% jitter
- Concurrency: 1
- Per-user isolation: `user:{userId}:inbox-monitor`

## Testing

- Unit test: rule-based classifier with sample messages (German + English)
- Unit test: message deduplication
- Integration test: classifier with Claude API mock
- Fixtures: sample inbox HTML, sample messages per intent

## Open Issues

None yet.
