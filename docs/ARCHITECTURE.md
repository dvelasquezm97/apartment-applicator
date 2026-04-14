# Architecture

> Last updated: 2026-04-14
> Status: DESIGNED

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                            │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│   │  Immoscout24  │  │   Telegram   │  │    Google Calendar       │ │
│   │  (browser UI) │  │   Bot API    │  │    (googleapis)          │ │
│   └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘ │
└──────────┼─────────────────┼───────────────────────┼───────────────┘
           │ Playwright      │ grammy webhook         │ OAuth2
           │                 │                        │
┌──────────┼─────────────────┼───────────────────────┼───────────────┐
│          │           API PROCESS (src/index.ts)     │               │
│          │                 │                        │               │
│          │    ┌────────────┴────────────┐           │               │
│          │    │    Fastify Server       │           │               │
│          │    │    ├── /health          │           │               │
│          │    │    ├── /api/*           ├───────────┘               │
│          │    │    ├── /admin/queues    │                           │
│          │    │    └── /webhooks/tg     │                           │
│          │    └────────────┬────────────┘                           │
│          │                 │                                        │
│          │    ┌────────────┴────────────┐                           │
│          │    │   Telegram Bot (grammy) │                           │
│          │    │   /status /pause        │                           │
│          │    │   /resume /screenshot   │                           │
│          │    └─────────────────────────┘                           │
│          │                                                          │
│  ┌───────┴──────────────────────────────────────────────────┐      │
│  │                   React Dashboard                         │      │
│  │  (Vite build served by @fastify/static in production)     │      │
│  │  Pages: Overview | Applications | Inbox | Appointments    │      │
│  │         Documents | Profile | Settings | Queue | Logs     │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │      Redis        │
                    │  (Railway plugin) │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┼──────────────────────────────────────┐
│                    WORKER PROCESS (src/worker.ts)                   │
│                             │                                      │
│  ┌──────────────────────────┴───────────────────────────────────┐  │
│  │                    BullMQ Workers                             │  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │  │
│  │  │ listing-monitor  │  │  auto-apply      │  │ inbox-monitor│ │  │
│  │  │ (repeatable 8m)  │  │  (event-driven)  │  │ (repeat 5m)  │ │  │
│  │  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │  │
│  │           │ enqueues             │                    │         │  │
│  │           └─────────────────────►│  classifies ───────┘         │  │
│  │                                                    │            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────┴───────┐  │  │
│  │  │ document-sender  │  │ appointment      │  │ external-form│  │  │
│  │  │ (event-driven)   │  │ (event-driven)   │  │ (event-drv)  │  │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘  │  │
│  │                                                               │  │
│  │  ┌─────────────────┐                                         │  │
│  │  │ reconciliation   │  Runs once on worker startup            │  │
│  │  └─────────────────┘                                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                             │                                      │
│  ┌──────────────────────────┴───────────────────────────────────┐  │
│  │              Browser Pool (Module 1)                          │  │
│  │  Max BROWSER_POOL_SIZE concurrent Chromium instances          │  │
│  │  Checkout/return pattern — idle sessions stay warm            │  │
│  │  Cookies: serialised → AES-256-GCM → Supabase DB            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    Supabase       │
                    │  ┌─────────────┐  │
                    │  │ PostgreSQL   │  │
                    │  │ (RLS)       │  │
                    │  ├─────────────┤  │
                    │  │ Auth        │  │
                    │  ├─────────────┤  │
                    │  │ Storage     │  │
                    │  │ (private)   │  │
                    │  └─────────────┘  │
                    └───────────────────┘
```

## Data Flow

### Happy Path: Listing Discovery → Application → Response Handling

```
1. Listing Monitor (repeatable every ~8 min ±20% jitter)
   │ Navigate to saved searches in browser
   │ Scrape new listings
   │ Deduplicate on immoscout_id
   │ Check daily cap + blackout hours
   │
   ▼
2. Auto-Apply (event-driven, one job per new listing)
   │ Navigate to listing page
   │ Fill application form
   │ Upload documents from Supabase Storage
   │ Submit via browser UI
   │ Status: APPLYING → APPLIED (or → FAILED → retry)
   │
   ▼
3. Inbox Monitor (repeatable every ~5 min ±20% jitter)
   │ Navigate to Immoscout inbox
   │ Parse new inbound messages per thread
   │ Classify intent (Claude API if ambiguous)
   │
   ├──► Document Request → Module 5 (Document Sender)
   │    Status: APPLIED → DOCUMENTS_REQUESTED → DOCUMENTS_SENT
   │
   ├──► Viewing Invitation → Module 6 (Appointment Handler)
   │    Status: → VIEWING_INVITED → VIEWING_SCHEDULED
   │    + Google Calendar event
   │
   ├──► External Form URL → Module 7 (External Form Auto-Fill)
   │    Status: → EXTERNAL_FORM_DETECTED → EXTERNAL_FORM_FILLING
   │    → AWAITING_USER_INPUT (if unknown fields) → EXTERNAL_FORM_SENT
   │
   └──► Other → Log + Telegram notification
```

### External Form Sub-Flow (Module 7)

```
External form URL detected
  │
  ▼
Open form in new browser context
  │
  ▼
Claude API: analyze form HTML → extract field schema
  │
  ▼
Map known fields to user profile data
  │
  ├── All fields mapped → fill + submit → EXTERNAL_FORM_SENT
  │
  └── Unknown fields exist
      │ Insert pending_question per unknown field
      │ Set bot_session for user
      │ Pause BullMQ job
      │ Send Telegram question
      │
      ├── User answers within 24h → resume job, fill field, continue
      │
      └── 24h timeout → skip field, resume job, notify user
```

## Browser Pool Design

- Max `BROWSER_POOL_SIZE` (default 2, env var) concurrent Chromium instances
- Checkout/return pattern: workers request a page via `getPage(userId)`
- Idle sessions stay warm (browser open, no active navigation)
- One BrowserContext per user — isolates cookies and state
- Session lifecycle:
  1. Worker requests page → pool checks for existing context
  2. If exists and cookies valid → return existing page
  3. If no context or cookies expired → create context, restore cookies, login if needed
  4. Worker completes → returns page to pool (context stays open)
  5. Idle timeout (30 min) → close context, persist cookies to Supabase
- On CAPTCHA detection: screenshot → close context → circuit breaker → Telegram alert

## Job Queue Topology

All queues are per-user isolated: `user:{userId}:{queueName}`

| Queue | Type | Interval | Concurrency | Triggers |
|-------|------|----------|-------------|----------|
| listing-monitor | Repeatable | ~8 min ±20% | 1 | Enqueues auto-apply jobs |
| auto-apply | Event-driven | — | 1 | Triggered by listing-monitor |
| inbox-monitor | Repeatable | ~5 min ±20% | 1 | Enqueues document-sender, appointment, external-form |
| document-sender | Event-driven | — | 1 | Triggered by inbox classifier |
| appointment | Event-driven | — | 1 | Triggered by inbox classifier |
| external-form | Event-driven | — | 1 | Triggered by inbox classifier |
| reconciliation | One-shot | Worker startup | 1 | — |

**Configuration for all queues:**
- `removeOnComplete: false` — jobs always inspectable
- `removeOnFail: false` — failed jobs stay for debugging
- Default retry: 3 attempts, exponential backoff (5s, 10s, 20s)

## Circuit Breaker Rules

| Trigger | Threshold | Open Duration | Action |
|---------|-----------|---------------|--------|
| CAPTCHA detected | 1 failure | 30 min | Pause ALL user jobs, Telegram alert with screenshot |
| Rate limit (429) | 1 failure | 60 min | Pause ALL user jobs, Telegram alert |
| Generic browser error | 5 consecutive | 15 min | Pause specific queue, Telegram alert |

**States:** CLOSED (normal) → OPEN (all requests fail-fast) → HALF_OPEN (allow 1 probe)

On circuit open: send Telegram alert, set `automation_paused = true` for user.
On manual `/resume`: reset circuit to CLOSED, set `automation_paused = false`.

## Startup Reconciliation

On every worker boot:
1. Find all applications in APPLYING or EXTERNAL_FORM_FILLING with no active BullMQ job
2. If age < 30 min: re-enqueue the job (assume crash during processing)
3. If age >= 30 min: mark FAILED, increment retry_count, re-enqueue if retries < 3
4. Find users with `automation_paused = false` but no active repeatable jobs → re-register repeatables
