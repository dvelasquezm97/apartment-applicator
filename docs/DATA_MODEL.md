# Data Model

> Last updated: 2026-04-16
> Status: DEPLOYED (Supabase project "pacific" — mxovgbinhedtpnczrciy)
> This file must always reflect actual current Supabase schema.
>
> **All tables use `bk_` prefix** (shared Supabase project).

## Tables

### bk_users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | User ID (dev seed: `00000000-0000-0000-0000-000000000001`) |
| telegram_chat_id | bigint | nullable | Telegram chat ID for notifications |
| immoscout_email | text | not null | Immoscout24 login email |
| immoscout_password_encrypted | text | not null | AES-256-GCM encrypted password |
| immoscout_cookies_encrypted | text | nullable | Serialised browser session, AES-256-GCM encrypted |
| profile | jsonb | default '{}' | {name, dob, nationality, phone, occupation, employer, income, schufaScore, moveInDate, street, houseNumber, zipCode, city, numberOfPersons, ...} |
| daily_application_count | integer | default 0 | Reset daily, tracks against DAILY_APPLICATION_CAP |
| daily_application_reset_at | timestamptz | nullable | When daily_application_count was last reset |
| automation_paused | boolean | default false | true = all jobs paused for this user |
| created_at | timestamptz | default now() | — |
| updated_at | timestamptz | default now() | Auto-updated via trigger |

### bk_documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| user_id | uuid | FK bk_users(id), not null | Owner |
| type | text | not null, CHECK | CV, INCOME_PROOF, COVER_LETTER, SCHUFA, OTHER |
| filename | text | not null | Original filename |
| storage_key | text | not null | Supabase Storage path: `{userId}/{type}/{filename}` |
| uploaded_at | timestamptz | default now() | — |

### bk_listings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| immoscout_id | text | UNIQUE, not null | Immoscout24 listing ID — deduplication key |
| url | text | not null | Full Immoscout24 listing URL |
| title | text | not null | Listing title |
| address | text | nullable | Street address |
| rent | numeric | nullable | Warm rent in EUR |
| size | numeric | nullable | Size in sqm |
| rooms | numeric | nullable | Number of rooms |
| discovered_at | timestamptz | default now() | When first scraped |
| status | text | default 'active' | active, delisted |

### bk_applications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| user_id | uuid | FK bk_users(id), not null | Applicant |
| listing_id | uuid | FK bk_listings(id), not null | Target listing |
| status | application_status | not null, default 'APPLYING' | See state machine below |
| retry_count | integer | default 0, max 3 | Incremented on each FAILED → APPLYING retry |
| timeline | jsonb | default '[]' | Array of {status, timestamp, note} events |
| created_at | timestamptz | default now() | — |
| updated_at | timestamptz | default now() | Auto-updated via trigger |

**application_status enum values:**
APPLYING, APPLIED, FAILED, DOCUMENTS_REQUESTED, DOCUMENTS_SENT,
VIEWING_INVITED, VIEWING_SCHEDULED, EXTERNAL_FORM_DETECTED,
EXTERNAL_FORM_FILLING, AWAITING_USER_INPUT, EXTERNAL_FORM_SENT, CLOSED

### bk_messages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| application_id | uuid | FK bk_applications(id), not null | Related application |
| direction | text | not null, CHECK IN ('INBOUND','OUTBOUND') | Message direction |
| content | text | not null | Message body |
| received_at | timestamptz | not null | When message was sent/received |
| processed_at | timestamptz | nullable | When we processed this message |

### bk_appointments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| application_id | uuid | FK bk_applications(id), not null | Related application |
| datetime | timestamptz | not null | Viewing date and time |
| address | text | nullable | Viewing address |
| google_calendar_event_id | text | nullable | GCal event ID after creation |
| calendar_added | boolean | default false | Whether GCal event was created |

### bk_pending_questions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| application_id | uuid | FK bk_applications(id), not null | Related application |
| field_name | text | not null | Form field identifier |
| field_label | text | not null | Human-readable field label |
| asked_at | timestamptz | default now() | When question was sent via Telegram |
| answered_at | timestamptz | nullable | When user replied |
| answer | text | nullable | User's answer |
| timed_out_at | timestamptz | nullable | Set after 24h with no answer |

### bk_bot_sessions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | — |
| user_id | uuid | FK bk_users(id), not null | Owner |
| telegram_chat_id | bigint | not null | Telegram chat for this session |
| awaiting_field | text | nullable | Field name we're waiting for |
| awaiting_application_id | uuid | FK bk_applications(id), nullable | Application context |
| awaiting_job_id | text | nullable | BullMQ job ID to resume |
| expires_at | timestamptz | not null | 24h from asked_at |

**Timeout logic:** If no answer by `expires_at`: mark pending_question as timed_out,
skip field, resume BullMQ job with blank value, notify user via Telegram.

**Conflict handling:** If two simultaneous questions for same user, queue the second —
only one `bot_session` active per user at a time.

---

## Application Status State Machine

### Valid Transitions

```
APPLYING → APPLIED
APPLYING → FAILED

APPLIED → DOCUMENTS_REQUESTED
APPLIED → VIEWING_INVITED
APPLIED → CLOSED
APPLIED → EXTERNAL_FORM_DETECTED

DOCUMENTS_REQUESTED → DOCUMENTS_SENT

DOCUMENTS_SENT → VIEWING_INVITED
DOCUMENTS_SENT → CLOSED

VIEWING_INVITED → VIEWING_SCHEDULED

EXTERNAL_FORM_DETECTED → EXTERNAL_FORM_FILLING

EXTERNAL_FORM_FILLING → AWAITING_USER_INPUT
EXTERNAL_FORM_FILLING → EXTERNAL_FORM_SENT

AWAITING_USER_INPUT → EXTERNAL_FORM_FILLING

EXTERNAL_FORM_SENT → CLOSED

FAILED → APPLYING  (retry: only if retry_count < 3, then → CLOSED + alert)
```

### Transition Rules

1. **Any transition not listed above MUST throw an error and trigger a Telegram alert.**
2. Every transition appends to the `timeline` JSONB array: `{status, timestamp, note}`.
3. Every transition updates `updated_at` and `status`.
4. FAILED → APPLYING: increment `retry_count`. If `retry_count >= 3`, transition to CLOSED instead and send alert.
5. The state machine is implemented in `src/lib/state-machine.ts` and is the ONLY code path that changes application status.

### State Diagram

```
                    ┌──────────┐
                    │ APPLYING │◄──────────────────────────────┐
                    └────┬─────┘                               │
                         │                                     │ retry (max 3)
                    ┌────┴────┐                           ┌────┴───┐
               ┌────┤ APPLIED │                           │ FAILED │
               │    └────┬────┘                           └────────┘
               │         │
    ┌──────────┼─────────┼──────────────────┐
    │          │         │                  │
    ▼          ▼         ▼                  ▼
┌────────┐ ┌───────┐ ┌──────────┐  ┌───────────────┐
│ CLOSED │ │DOCS_  │ │VIEWING_  │  │EXTERNAL_FORM_ │
│        │ │REQSTD │ │INVITED   │  │DETECTED       │
└────────┘ └───┬───┘ └────┬─────┘  └───────┬───────┘
               │          │                │
               ▼          ▼                ▼
          ┌────────┐ ┌─────────┐   ┌──────────────┐
          │DOCS_   │ │VIEWING_ │   │EXTERNAL_FORM_│◄─┐
          │SENT    │ │SCHEDULED│   │FILLING       │  │
          └───┬────┘ └─────────┘   └──┬────────┬──┘  │
              │                       │        │     │
              ├──► VIEWING_INVITED    ▼        ▼     │
              └──► CLOSED       ┌─────────┐ ┌──────┐│
                                │AWAITING_│ │EXT_  ││
                                │USER_    ├─┘FORM_ ││
                                │INPUT    │  │SENT  │
                                └─────────┘  └──┬───┘
                                                │
                                                ▼
                                           ┌────────┐
                                           │ CLOSED │
                                           └────────┘
```

---

## RLS Policies

All tables have Row Level Security enabled. Pattern per table:

```sql
-- SELECT: users can only read their own data
CREATE POLICY {table}_select ON public.{table}
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: users can only insert their own data
CREATE POLICY {table}_insert ON public.{table}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own data
CREATE POLICY {table}_update ON public.{table}
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: users can only delete their own data
CREATE POLICY {table}_delete ON public.{table}
  FOR DELETE USING (auth.uid() = user_id);
```

**Exception — bk_users table:** Uses `auth.uid() = id` (not `user_id`).
Note: For pilot, auth.users FK is dropped (migration 00011). RLS bypassed via service role key.

**Exception — bk_listings table:** No `user_id` column. Listings are shared. SELECT allowed
for all authenticated users. INSERT/UPDATE/DELETE only via service role (workers).

**Workers:** Use `SUPABASE_SERVICE_ROLE_KEY` which bypasses all RLS.

---

## Storage Buckets

| Bucket | Access | Max File Size | Allowed MIME Types |
|--------|--------|---------------|-------------------|
| user-documents | Private (signed URLs, 5 min expiry) | 10 MB | application/pdf, image/jpeg, image/png |
| application-screenshots | Private (signed URLs) | 5 MB | image/png |

**Path convention:** `{userId}/{type}/{filename}`

**RLS:** Users can only access files prefixed with their own `userId`.
