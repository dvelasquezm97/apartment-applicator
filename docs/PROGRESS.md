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
