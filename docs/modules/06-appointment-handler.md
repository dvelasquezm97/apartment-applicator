# Module 6: Appointment Handler

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Parse viewing invitations from inbox messages, extract date/time/address,
create Google Calendar events, and notify the user via Telegram.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/appointment-handler/index.ts | Module exports |
| src/modules/appointment-handler/parser.ts | Extract datetime and address from invitation text |
| src/modules/appointment-handler/calendar.ts | Create Google Calendar event via googleapis |
| src/workers/appointment.worker.ts | BullMQ worker: process appointment jobs |

## Inputs

- Message content from inbox (the viewing invitation text)
- Application and listing details for context
- User's Google OAuth tokens from Supabase (encrypted)

## Outputs

- `appointments` row in Supabase with parsed datetime, address
- Google Calendar event created (if OAuth configured)
- Application status: VIEWING_INVITED → VIEWING_SCHEDULED
- Timeline entry appended
- Telegram: "Viewing: [date] [time] [address]"

## Dependencies

- Module 4 (Inbox Monitor) — creates the jobs this module processes

## Key Functions

```typescript
// Parse viewing invitation from message content
parseViewingInvite(content: string): Promise<{datetime: Date, address: string}>

// Create a Google Calendar event
createCalendarEvent(userId: string, appointment: Appointment): Promise<string>
```

## Parsing Strategy

1. **Regex patterns** for common German date/time formats:
   - "am DD.MM.YYYY um HH:MM"
   - "DD.MM. um HH:MM Uhr"
   - ISO dates
2. **Claude API fallback** if regex fails:
   - Extract structured {date, time, address} from free text
   - Model: claude-sonnet

## Error Handling

- **Date parsing fails:** Telegram alert with raw message, ask user to confirm manually
- **Google OAuth not configured:** Skip calendar, still update status, Telegram notify
- **OAuth token expired:** Refresh token, retry. If refresh fails, alert user to re-auth
- **Calendar API error:** Log, skip calendar creation, still update appointment record

## Queue Config

- Queue: `appointment`
- Type: Event-driven (enqueued by inbox-monitor)
- Concurrency: 1
- Per-user isolation: `user:{userId}:appointment`
- Retry: 2 attempts

## Testing

- Unit test: date parser with German locale samples
- Unit test: address extraction from invitation text
- Integration test: Google Calendar event creation with mock googleapis

## Open Issues

None yet.
