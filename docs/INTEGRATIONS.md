# Integrations

> Last updated: 2026-04-14
> Status: DESIGNED

## Telegram Bot (grammy.js)

### Setup

```typescript
import { Bot } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
```

### Mode

| Environment | Mode | Config |
|-------------|------|--------|
| Production | Webhook | Fastify route: POST /webhooks/telegram |
| Development | Long polling | bot.start() |

### Commands

| Command | Handler | Description |
|---------|---------|-------------|
| /start | Register telegram_chat_id for user | Initial setup |
| /status | Query active applications | "5 active, 2 pending docs, 1 viewing" |
| /pause | Set automation_paused=true | Stops all repeatable jobs |
| /resume | Set automation_paused=false | Re-registers repeatables, resets circuit breaker |
| /screenshot | Capture browser screenshot | Sends photo for debugging |
| /health | Check all systems | Redis, Supabase, browser status |

### Stateful Conversation: Pending Questions

Uses `bot_sessions` table to track conversation state per user.

```
Module 7 calls askPendingQuestion(userId, fieldName, fieldLabel)
  │
  ▼
INSERT INTO bot_sessions (user_id, telegram_chat_id, awaiting_field,
  awaiting_application_id, awaiting_job_id, expires_at)
  │
  ▼
Send Telegram: "For [listing], please answer: [fieldLabel]?"
  │
  ├── User replies within 24h
  │   │ Match reply to active bot_session via telegram_chat_id
  │   │ UPDATE pending_questions SET answer=reply, answered_at=now()
  │   │ DELETE bot_session
  │   │ Resume BullMQ job
  │   └── Send: "Got it, continuing with the form."
  │
  └── 24h timeout (checked by scheduled job)
      │ UPDATE pending_questions SET timed_out_at=now()
      │ DELETE bot_session
      │ Resume BullMQ job with blank answer
      └── Send: "No answer for [fieldLabel], skipping this field."
```

**Conflict handling:** Only ONE active `bot_session` per user at a time.
If a second question arrives, queue it — it will be asked after the first
is answered or times out.

### Pending Question Timeout

- Checked by a BullMQ repeatable job every 15 minutes
- Queries: `SELECT * FROM bot_sessions WHERE expires_at < now()`
- For each expired session: skip field, resume job, notify user, delete session

## Google Calendar (googleapis)

### OAuth2 Flow

```
User clicks "Connect Google Calendar" in dashboard
  │
  ▼
Redirect to Google OAuth consent screen
  (scope: calendar.events)
  │
  ▼
Google redirects to GOOGLE_REDIRECT_URI with code
  │
  ▼
Exchange code for access_token + refresh_token
  │
  ▼
Encrypt tokens → store in users.google_oauth_tokens (Supabase)
```

**IMPORTANT — Sequencing Constraint:**
The Fastify server MUST be live and publicly accessible BEFORE the OAuth
callback can work. On first deploy: deploy the server first, then configure
the redirect URI in GCP console to point to the live URL.

### Token Refresh

```typescript
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Tokens decrypted from Supabase
oauth2Client.setCredentials({ refresh_token: decryptedRefreshToken });

// googleapis SDK auto-refreshes when access_token expires
```

### Calendar Event Creation

```typescript
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

await calendar.events.insert({
  calendarId: 'primary',
  requestBody: {
    summary: `Viewing: ${listing.title}`,
    location: appointment.address,
    description: `Listing: ${listing.url}`,
    start: { dateTime: appointment.datetime.toISOString(), timeZone: 'Europe/Berlin' },
    end: { dateTime: endTime.toISOString(), timeZone: 'Europe/Berlin' }, // +30min default
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
  },
});
```

## Supabase

### Client Configuration

Two clients, different permission levels:

```typescript
// Admin client — used by workers, bypasses RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Anon client — used by dashboard API, respects RLS
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

### Storage: Document Access

```typescript
// Upload (worker or API)
const { data, error } = await supabaseAdmin.storage
  .from('user-documents')
  .upload(`${userId}/${type}/${filename}`, fileBuffer, { contentType: mimeType });

// Download via signed URL (5 min expiry)
const { data: { signedUrl } } = await supabaseAdmin.storage
  .from('user-documents')
  .createSignedUrl(`${userId}/${type}/${filename}`, 300);
```

## Claude API (@anthropic-ai/sdk)

### Usage by Module

| Module | Use Case | Model |
|--------|----------|-------|
| Module 4 (Inbox) | Classify ambiguous message intent | claude-sonnet |
| Module 6 (Appointment) | Parse date/time from free text (fallback) | claude-sonnet |
| Module 7 (External Form) | Analyze form HTML → field schema + mapping | claude-sonnet |

### Prompt Strategy: Message Classification (Module 4)

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20241022',
  max_tokens: 256,
  tools: [{
    name: 'classify_message',
    description: 'Classify the intent of an Immoscout24 inbox message',
    input_schema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['DOCUMENT_REQUEST', 'VIEWING_INVITE', 'EXTERNAL_FORM', 'REJECTION', 'GENERIC']
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' }
      },
      required: ['intent', 'confidence', 'reasoning']
    }
  }],
  tool_choice: { type: 'tool', name: 'classify_message' },
  messages: [{ role: 'user', content: `Classify this Immoscout24 message:\n\n${messageContent}` }]
});
```

### Prompt Strategy: Form Analysis (Module 7)

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20241022',
  max_tokens: 2048,
  tools: [{
    name: 'analyze_form',
    description: 'Analyze HTML form and map fields to user profile',
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string', enum: ['text', 'select', 'checkbox', 'radio', 'date', 'file'] },
              profileKey: { type: 'string', description: 'Matching key from user profile, or null' },
              requiresUserInput: { type: 'boolean' }
            }
          }
        }
      },
      required: ['fields']
    }
  }],
  tool_choice: { type: 'tool', name: 'analyze_form' },
  messages: [{
    role: 'user',
    content: `Analyze this form. Map fields to user profile keys where possible.\nProfile keys: name, dob, nationality, phone, occupation, employer, income, schufaScore, moveInDate\n\nForm HTML:\n${cleanedHtml}`
  }]
});
```
