# Module 10: Web Dashboard

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

React + Vite web dashboard for monitoring and managing the automation.
Provides full visibility into applications, inbox, appointments, documents,
user profile, settings, queue status, and logs.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/dashboard/index.ts | Fastify plugin: register API routes, serve static build |
| src/modules/dashboard/routes.ts | Dashboard-specific API routes |
| web/src/App.tsx | Router + layout |
| web/src/pages/*.tsx | Individual page components |
| web/src/hooks/*.ts | Auth and API hooks |
| web/src/lib/*.ts | Supabase client, API client |

## Pages

| Page | Path | Content |
|------|------|---------|
| Overview | / | Stats, circuit breaker status, daily cap counter |
| Applications | /applications | Table with status, listing details, full timeline, screenshots |
| Inbox | /inbox | Mirrored Immoscout threads per application |
| Appointments | /appointments | Calendar view of upcoming viewings |
| Documents | /documents | Upload/manage CV, proof of income, cover letter, SCHUFA |
| Profile | /profile | Personal details for form auto-fill |
| Settings | /settings | Immoscout creds, Telegram setup, Google Calendar OAuth, caps |
| Queue | /queue | Embedded Bull Board UI |
| Logs | /logs | Real-time pino structured logs via SSE |
| Login | /login | Supabase Auth (magic link or email/password) |

## Inputs

- Supabase Auth for JWT sessions
- Fastify API endpoints for all data
- Supabase Realtime for live dashboard updates (optional enhancement)

## Outputs

- User can view all automation state
- User can upload/manage documents
- User can update profile for form auto-fill
- User can configure settings (daily cap, blackout hours, etc.)
- User can initiate Google Calendar OAuth flow
- User can pause/resume automation

## Dependencies

- None directly (consumes API endpoints)

## Architecture

- **Dev:** Vite dev server with proxy to Fastify API
- **Production:** Vite builds to `web/dist/`, served by @fastify/static
- **Auth:** Supabase Auth client-side, JWT sent to API in Authorization header

## Error Handling

- **API errors:** Toast notifications with error details
- **Auth expired:** Redirect to login
- **Network offline:** Show connection status indicator

## Testing

- Component tests for critical pages (Applications, Documents)
- E2E tests with Playwright (stretch goal)

## Open Issues

None yet.
