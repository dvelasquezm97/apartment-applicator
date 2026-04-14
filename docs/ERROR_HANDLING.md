# Error Handling

> Last updated: 2026-04-14
> Status: DESIGNED

## Retry Strategy per Module

| Module | Max Attempts | Backoff | Failure Definition |
|--------|-------------|---------|-------------------|
| M1 Session | 2 | 5s, 15s | Login failure, browser crash |
| M2 Listing Monitor | 1 | — | Scrape failure (skip cycle, retry next interval) |
| M3 Auto-Apply | 3 | 5s, 10s, 20s | Form submission failure |
| M4 Inbox Monitor | 1 | — | Parse failure (skip cycle, retry next interval) |
| M5 Document Sender | 3 | 5s, 10s, 20s | Upload/send failure |
| M6 Appointment | 2 | 5s, 15s | Calendar creation failure |
| M7 External Form | 2 | 5s, 15s | Form fill/submit failure |

**BullMQ retry config:**
```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
}
```

**Application-level retry (FAILED → APPLYING):**
- Max 3 total attempts (tracked in `applications.retry_count`)
- After 3 failures: transition to CLOSED, send Telegram alert
- This is separate from BullMQ job retries — a single "attempt" may include
  multiple BullMQ retries before marking the application as FAILED

## Dead Letter Queue (DLQ)

Jobs that exhaust all BullMQ retries are moved to the DLQ:

- Each queue has a companion DLQ: `{queueName}:dlq`
- Failed jobs retain full data (payload, error, stack trace, timestamps)
- DLQ contents visible in Bull Board UI at `/admin/queues`
- DLQ jobs are NOT auto-retried — manual intervention required
- Telegram alert sent when any job enters DLQ

```typescript
// BullMQ worker error handler
worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Job exhausted retries — now in DLQ
    await notifyTelegram(job.data.userId,
      `Job failed permanently: ${job.name}\nError: ${err.message}`);
  }
});
```

## Circuit Breaker

Three states: CLOSED (normal) → OPEN (fail-fast) → HALF_OPEN (probing)

### Triggers

| Trigger | Open Threshold | Open Duration | Scope |
|---------|---------------|---------------|-------|
| CAPTCHA detected | 1 occurrence | 30 minutes | All queues for user |
| HTTP 429 / rate limit | 1 occurrence | 60 minutes | All queues for user |
| Generic browser error | 5 consecutive | 15 minutes | Specific queue |

### Behaviour

**CLOSED (normal):**
- All requests pass through
- Track consecutive failure count

**OPEN (blocking):**
- All requests fail immediately (no browser action)
- Set `users.automation_paused = true`
- Send Telegram alert with error details
- Timer starts for auto-transition to HALF_OPEN

**HALF_OPEN (probing):**
- Allow ONE request through as a probe
- If probe succeeds: → CLOSED, reset failure count, resume automation
- If probe fails: → OPEN, restart timer

### Manual Override

- `/resume` Telegram command: force circuit to CLOSED, resume all jobs
- `/pause` Telegram command: force circuit to OPEN, pause all jobs

### Implementation

```typescript
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureAt: Date | null;
  openedAt: Date | null;
  openDurationMs: number;
}
```

State stored in Redis per user: `circuit:{userId}:{scope}`

## Startup Reconciliation

On every worker process boot (`src/worker.ts`):

```
1. Query: SELECT * FROM applications
   WHERE status IN ('APPLYING', 'EXTERNAL_FORM_FILLING')
   AND updated_at < now() - interval '5 minutes'

2. For each stuck application:
   a. Check if a BullMQ job exists and is active → skip (still running)
   b. If no active job AND age < 30 min:
      → Re-enqueue the job (assume crash during processing)
   c. If no active job AND age >= 30 min:
      → Mark FAILED, increment retry_count
      → If retry_count < 3: re-enqueue
      → If retry_count >= 3: mark CLOSED, alert

3. For each user with automation_paused = false:
   → Verify repeatable jobs are registered
   → If missing: re-register listing-monitor and inbox-monitor repeatables

4. Log reconciliation summary: "Reconciled X stuck applications, Y re-enqueued"
```

## /health Endpoint

`GET /health` — checks all systems simultaneously, returns structured JSON.

### Checks

| System | Check | Timeout |
|--------|-------|---------|
| Redis | `redis.ping()` | 3s |
| Supabase | `supabase.from('users').select('id').limit(1)` | 5s |
| Browser Pool | Count active/idle sessions | instant |
| Circuit Breaker | Any user circuits in OPEN state | instant |

### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2026-04-14T10:00:00Z",
  "checks": {
    "redis": { "status": "ok", "latencyMs": 2 },
    "supabase": { "status": "ok", "latencyMs": 45 },
    "browserPool": { "status": "ok", "active": 1, "idle": 0, "max": 2 },
    "circuitBreaker": { "status": "ok", "openCircuits": 0 }
  }
}
```

**HTTP status:**
- 200 if all checks pass
- 503 if any check fails (with details in response body)

### Monitoring

- Railway health check polls `/health` every 30s
- BullMQ nightly health check job verifies browser session is alive
  (navigate to Immoscout homepage, check for login state, no actions)
- If `/health` fails: Telegram alert via scheduled ping job

## State Recovery: Partial Application

If Playwright crashes mid-application:

1. BullMQ job times out (default 5 min timeout)
2. Job is retried by BullMQ (up to configured attempts)
3. On retry: check application status in DB
   - If still APPLYING: assume form was NOT submitted, start fresh
   - If APPLIED: application went through before crash, mark success
4. If all retries exhausted: mark FAILED, enter application-level retry flow
5. Browser context is auto-cleaned by Playwright on process exit
6. Cookies are persisted at known-good checkpoints, not continuously
