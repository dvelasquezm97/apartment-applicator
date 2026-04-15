# CTO Technical Plan: BerlinKeys Phase A — API Layer + Dashboard

**Date:** 2026-04-15
**Paperclip project:** Phase A: API + Dashboard (4f24cba9)
**Goal:** Testable UI where David can enter credentials, upload documents, see applications, and control automation.

## Technical Overview

Phase A adds the two missing layers on top of the complete M1-M4 worker pipeline: a Fastify API server with auth/plugins and a React dashboard. The API serves as a thin layer over Supabase — most routes are CRUD with JWT-based auth. The frontend uses Supabase Auth for login and React Query for data fetching. No new business logic — this is plumbing to make the existing workers observable and controllable.

## Architecture Decision: Supabase Auth + JWT

- Login via Supabase Auth (magic link or email/password)
- Frontend gets JWT from Supabase, sends as `Authorization: Bearer` header
- API middleware verifies JWT via Supabase, extracts `user_id`
- All queries scoped to `user_id` (service role key, manual WHERE clause — workers already bypass RLS)
- No new auth tables needed

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.ts` | Wire plugins (CORS, multipart, rate-limit, static), register auth decorator |
| `src/api/health.ts` | Real checks: Redis ping, Supabase ping, browser pool stats |
| `src/api/applications.ts` | CRUD: list, get, get messages for application |
| `src/api/listings.ts` | CRUD: list, get |
| `src/api/documents.ts` | CRUD: list, upload (multipart), delete, signed URL |
| `src/api/settings.ts` | GET/PUT user settings, PUT profile, pause/resume toggle |
| `src/api/stats.ts` | Dashboard stats: counts by status, daily cap, circuit breaker |
| `web/src/lib/api.ts` | Add JWT from Supabase session to all requests |
| `web/src/lib/supabase.ts` | Already done (just needs env vars) |
| `web/src/hooks/useAuth.ts` | Real Supabase Auth hook with session listener |
| `web/src/hooks/useApi.ts` | React Query hooks for all endpoints |
| `web/src/pages/Login.tsx` | Supabase Auth form (email/password) |
| `web/src/pages/Dashboard.tsx` | Stats cards, daily progress bar, circuit breaker status |
| `web/src/pages/Applications.tsx` | Table with StatusBadge, click to expand timeline + messages |
| `web/src/pages/Documents.tsx` | Upload form, document list with delete, type badges |
| `web/src/pages/Settings.tsx` | Immoscout credentials, profile fields, automation toggle |
| `web/src/components/Layout.tsx` | Add auth guard (redirect to /login if no session) |

## Files to Create

| File | Description |
|------|-------------|
| `src/api/middleware/auth.ts` | Fastify preHandler: verify Supabase JWT, set `request.userId` |
| `web/src/components/AuthGuard.tsx` | Wrapper that redirects unauthenticated users to /login |
| `web/src/components/StatsCard.tsx` | Reusable stats card component for dashboard |
| `web/src/components/Timeline.tsx` | Application timeline component (status history) |
| `web/src/components/DocumentUpload.tsx` | File upload component with drag-and-drop |

## Data Model Changes

None — all tables exist from the scaffold migration.

## API Endpoints

### Auth-protected (all require JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Dashboard overview stats |
| GET | `/api/applications` | List user's applications (with listing info) |
| GET | `/api/applications/:id` | Application detail with timeline |
| GET | `/api/applications/:id/messages` | Messages for an application |
| GET | `/api/listings` | List discovered listings |
| GET | `/api/listings/:id` | Listing detail |
| GET | `/api/documents` | List user's documents |
| POST | `/api/documents` | Upload document (multipart/form-data) |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/documents/:id/url` | Get signed download URL |
| GET | `/api/settings` | Get user settings + profile |
| PUT | `/api/settings` | Update Immoscout credentials + automation toggle |
| PUT | `/api/settings/profile` | Update user profile fields |

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (Redis, Supabase, browser pool) |

## Implementation Order

### Phase A1: Server Foundation
1. `src/api/middleware/auth.ts` — JWT verification
2. `src/index.ts` — Wire CORS, multipart, rate-limit, static, auth

### Phase A2: Critical API Routes (settings + documents first — needed to configure and feed the workers)
3. `src/api/settings.ts` — Credential entry, profile, pause toggle
4. `src/api/documents.ts` — Upload, list, delete, signed URLs

### Phase A3: Observation API Routes
5. `src/api/applications.ts` — List, detail, messages
6. `src/api/listings.ts` — List, detail
7. `src/api/stats.ts` — Dashboard stats
8. `src/api/health.ts` — Real health checks

### Phase A4: Frontend Foundation
9. `web/src/hooks/useAuth.ts` — Supabase Auth
10. `web/src/lib/api.ts` — JWT injection
11. `web/src/hooks/useApi.ts` — React Query hooks
12. `web/src/components/AuthGuard.tsx` — Route protection
13. `web/src/pages/Login.tsx` — Auth form

### Phase A5: Dashboard Pages
14. `web/src/pages/Settings.tsx` — Credentials + profile + pause
15. `web/src/pages/Documents.tsx` — Upload + manage
16. `web/src/pages/Dashboard.tsx` — Stats overview
17. `web/src/pages/Applications.tsx` — List + detail + timeline

## Test Strategy

- **API routes**: Integration tests with mocked Supabase (verify auth, query params, response shape)
- **Auth middleware**: Unit test JWT verification + rejection
- **Frontend**: Manual testing via dev server (React components are presentational)

## Agent Assignments

### Builder (Claude Code)
- **Task:** Implement all Phase A files
- **Focus:** Auth correctness, API response shapes matching frontend expectations
- **Depends on:** Nothing
- **Acceptance:** `npm run typecheck` clean, API routes return correct data, dashboard renders

### Codex CLI
- **Task:** Review each commit
- **Focus:** Auth bypass risks, credential exposure in API responses, XSS in frontend
- **Depends on:** Each commit
- **Acceptance:** No P1 security issues

### Staff Engineer — `/review`
- **Task:** Pre-ship diff review
- **Focus:** Auth middleware correctness, RLS enforcement, no credential leaks
- **Depends on:** Builder complete
- **Acceptance:** No blocking issues

### Compliance Officer — `/compliance-check`
- **Task:** Verify credential handling
- **Focus:** Encrypted passwords never returned in API responses, JWT validation, CORS policy
- **Depends on:** Builder complete
- **Acceptance:** No compliance violations

### Release Engineer — `/ship`
- **Task:** Create PR
- **Depends on:** Reviews pass
- **Acceptance:** PR created, CI green

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Credential exposure in API | Settings GET never returns password/cookies — only masked values |
| Auth bypass | Every /api/* route uses auth preHandler; health is public |
| XSS from message content | Messages rendered as text, not HTML |
| CORS misconfiguration | Allow only localhost:5173 in dev, specific domain in prod |
| Large file upload DoS | Multipart limit: 10MB, file type validation |

## Build Order

```
1. Builder: Server plugins + auth middleware (A1)
2. Builder: Settings + Documents API (A2)
3. Builder: Applications + Listings + Stats + Health API (A3)
4. Builder: Frontend auth + hooks (A4)
5. Builder: Dashboard pages (A5)
6. Codex: Reviews (continuous)
7. Staff Engineer: /review
8. Compliance: /compliance-check
9. Release Engineer: /ship
```
