# Progress

> Last updated: 2026-04-14
> Status: ACTIVE

## Session: 2026-04-14 — Project Scaffold

### What was done
- Evaluated gstack starter kit → SKIP (not a scaffold, it's a Claude Code skill pack)
- Decided on two-process deployment model (API + Worker)
- Decided on playwright-core + playwright-extra (not full playwright)
- Decided on snake_case for DB columns, camelCase for TypeScript
- Created full docs/ structure with initial content (23 files)
- Created .claude/commands/ session rituals (3 files)
- Created project scaffold with all modules stubbed
- Created Supabase migration SQL
- Created test scaffold

### Decisions made
- See docs/DECISIONS.md for all 4 decisions logged this session

### Current blockers
- None

### What to build next
- Module 1: Immoscout Session Manager (browser pool, login, cookie persistence)
- Need actual Immoscout account credentials to test login flow
- Need Supabase project created and migrations run

## Session: 2026-04-15 — M3 Auto-Apply

### What was done
- Implemented M3 Auto-Apply module (7 files, ~650 lines)
- Created centralized selector registry (selectors.ts) for Immoscout listing/form pages
- Created shared human simulation utilities (human-delay.ts)
- Implemented navigator.ts: listing navigation, availability detection, apply button click
- Implemented form-filler.ts: profile-to-form mapping, German cover letter composition
- Implemented submitter.ts: document download via signed URLs, upload, submit, result detection
- Implemented index.ts orchestrator: full pipeline with state machine integration
- Implemented auto-apply.worker.ts: BullMQ worker with retry logic, CAPTCHA pause, automation_paused check
- Added 3 unit test files + 1 integration test (all passing, 99 total tests)
- Updated BROWSER_AUTOMATION.md with listing page and application form selectors
- Created CTO plan and Paperclip issues for M3

### Decisions made
- CSS selectors centralized in one file for easy maintenance when Immoscout changes layout
- Human simulation extracted to shared utility (reusable by future modules)
- Documents downloaded to temp dir via signed URLs, cleaned up immediately after upload
- Conservative success detection: if no error after submit, assume APPLIED
- Screenshots taken on failure for debugging (uploaded to application-screenshots bucket)

### Current blockers
- CSS selectors need verification against live Immoscout24

### What to build next
- Module 4: Inbox Monitor (message detection, parsing landlord responses)

## Session: 2026-04-15 — M4 Inbox Monitor

### What was done
- Implemented M4 Inbox Monitor module (6 files, ~550 lines)
- Created inbox selectors registry (selectors.ts) for Immoscout messaging pages
- Implemented reader.ts: inbox navigation, thread scraping, message extraction, application matching
- Implemented classifier.ts: two-tier classification (rule-based patterns + Claude Sonnet API fallback with structured tool_use)
- Implemented router.ts: route classified messages to downstream queues (M5/M6/M7) + state machine transitions
- Implemented index.ts orchestrator: full pipeline with page release guarantee
- Implemented worker with automation pause check and CAPTCHA handling
- Added 3 test files: classifier unit tests (11 tests), reader unit tests (3 tests), integration test (5 tests)

### Decisions made
- Rule-based classifier handles German keywords for Unterlagen, Besichtigung, Absage, etc. — should catch >80% of messages
- Claude Sonnet API fallback only fires for ambiguous messages (confidence < 0.7)
- Messages matched to applications via immoscout_id extracted from thread listing links
- Rejection messages auto-close the application

### Current blockers
- Inbox selectors need verification against live Immoscout24
- ANTHROPIC_API_KEY env var needed for Claude fallback

### What to build next
- Module 5: Document Sender (auto-send documents on DOCUMENT_REQUEST)

## Session: 2026-04-15 — Phase A: API + Dashboard

### What was done
- CTO audit of full project state — identified API + Dashboard as critical path to testable UI
- Implemented Fastify server plugins: CORS, multipart upload (10MB), rate limiting, static file serving
- Implemented 7 API route files: settings (credentials + profile + pause), documents (upload/list/delete/signed URLs), applications (list with listings, detail with timeline, messages), listings, stats, health (real Redis + Supabase checks)
- Implemented frontend data layer: API client with file upload support, 9 React Query hooks
- Built 4 dashboard pages: Dashboard (stats cards, automation status), Applications (expandable list with timeline + messages), Documents (upload with type selection, list, delete), Settings (Immoscout credentials, profile form, pause/resume toggle)
- Removed login/auth — all routes open for dev testing
- Updated App.tsx to skip login page, route directly to dashboard
- Created Paperclip project for Phase A with 12 subtask issues
- Fixed Paperclip issue update endpoint (was using wrong route — documented in memory)

### Decisions made
- Skip auth for now — all API routes are open, using X-User-Id header for dev
- Settings GET never exposes passwords — only masked values
- Supabase Auth planned for later (magic link or email/password)
- API routes use service role key (same as workers) — RLS enforcement deferred to auth phase

### Current blockers
- Need Supabase project created and migrations applied to test API routes
- Need Redis running for health checks and workers
- Need .env file with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL, ENCRYPTION_KEY
- CSS selectors for M3 and M4 need verification against live Immoscout24

### What to build next
- Set up Supabase project + run migrations + create .env
- Test dashboard end-to-end with real data
- Add auth (Supabase Auth) when ready for multi-user
- Module 5: Document Sender (reply to inbox thread with user documents)
- Module 6: Appointment Handler (parse viewing invite, create Google Calendar event)
- Module 9: Telegram Bot (notifications + /pause /resume /status commands)
