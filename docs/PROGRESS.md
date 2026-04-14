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
