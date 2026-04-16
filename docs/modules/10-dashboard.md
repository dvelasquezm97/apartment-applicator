# Module 10: Web Dashboard

> Last updated: 2026-04-16
> Status: IN_PROGRESS (API + pages + onboarding + live feed done; no auth)

## Purpose

React + Vite web dashboard for monitoring and managing the automation.
Provides full visibility into applications, inbox, appointments, documents,
user profile, settings, queue status, and logs. Includes a 4-step onboarding
wizard and a real-time live feed of apply progress.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/dashboard/index.ts | Fastify plugin: register API routes, serve static build |
| src/modules/dashboard/routes.ts | Dashboard-specific API routes |
| src/api/ws.ts | Fastify WebSocket plugin: extension + dashboard connections, event routing |
| src/api/apply.ts | REST endpoints: POST /api/apply/start, POST /api/apply/stop, GET /api/apply/status |
| src/orchestrator/types.ts | Shared WS message types (commands, events, progress updates) |
| src/orchestrator/apply-loop.ts | ApplyLoop class: scrape → filter → navigate → apply → record |
| web/src/App.tsx | Router + layout (includes /onboarding and /live routes) |
| web/src/pages/Onboarding.tsx | 4-step wizard: Profile → Search URL → Install Extension → Start |
| web/src/pages/LiveFeed.tsx | Real-time apply progress via WebSocket |
| web/src/pages/Settings.tsx | Immoscout creds, profile, search URL, pause/resume |
| web/src/pages/*.tsx | Other page components |
| web/src/hooks/useWebSocket.ts | React hook for WS dashboard connection with auto-reconnect |
| web/src/hooks/useApi.ts | API hooks including useApplyStatus, useStartApply, useStopApply |
| web/src/components/Layout.tsx | Sidebar nav (includes "Live Feed" link) |
| web/src/lib/*.ts | Supabase client, API client |

## Chrome Extension

| File | Responsibility |
|------|---------------|
| extension/manifest.json | Chrome Manifest V3 configuration |
| extension/background.ts | Service worker: WebSocket connection, command routing |
| extension/content.ts | Content script: DOM automation with verified Immoscout selectors |
| extension/popup.html | Extension popup UI |
| extension/popup.ts | Popup logic: live stats (applied/failed/skipped), connection status |

## Pages

| Page | Path | Content |
|------|------|---------|
| Overview | / | Stats, circuit breaker status, daily cap counter |
| Applications | /applications | Table with status, listing details, full timeline, screenshots |
| Inbox | /inbox | Mirrored Immoscout threads per application |
| Appointments | /appointments | Calendar view of upcoming viewings |
| Documents | /documents | Upload/manage CV, proof of income, cover letter, SCHUFA |
| Profile | /profile | Personal details for form auto-fill |
| Settings | /settings | Immoscout creds, search URL, Telegram setup, Google Calendar OAuth, caps |
| Queue | /queue | Embedded Bull Board UI |
| Logs | /logs | Real-time pino structured logs via SSE |
| Onboarding | /onboarding | 4-step wizard: Profile → Search URL → Install Extension → Start |
| Live Feed | /live | Real-time apply progress (applied/failed/skipped, status badge, results list, stop button) |
| Login | /login | Supabase Auth (magic link or email/password) — NOT YET IMPLEMENTED |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /ws | WebSocket upgrade (role=extension or role=dashboard) |
| POST | /api/apply/start | Start the apply loop |
| POST | /api/apply/stop | Stop the apply loop |
| GET | /api/apply/status | Current status + extensionConnected flag |
| PUT | /api/settings | Accepts searchUrl, onboardingComplete fields |

## Inputs

- Fastify API endpoints for all data
- WebSocket for real-time extension and dashboard communication
- Chrome extension for browser automation commands

## Outputs

- User can complete onboarding wizard to set up automation
- User can view real-time apply progress on Live Feed page
- User can start/stop the apply loop
- User can view all automation state
- User can upload/manage documents
- User can update profile for form auto-fill
- User can configure settings (search URL, daily cap, blackout hours, etc.)
- User can initiate Google Calendar OAuth flow
- User can pause/resume automation

## Dependencies

- Chrome extension for browser automation
- WebSocket connection for real-time communication

## Architecture

- **Dev:** Vite dev server with proxy to Fastify API
- **Production:** Vite builds to `web/dist/`, served by @fastify/static
- **Auth:** Not yet implemented — all routes open with dev user UUID
- **WebSocket:** `/ws?role=dashboard` for live feed updates, `/ws?role=extension` for command routing
- **Orchestrator:** ApplyLoop in `src/orchestrator/apply-loop.ts` coordinates extension commands

## Error Handling

- **API errors:** Toast notifications with error details
- **Extension disconnect:** Orchestrator stops, dashboard shows disconnected status
- **CAPTCHA detected:** Extension sends browser notification, orchestrator pauses
- **Network offline:** Show connection status indicator

## Testing

- Component tests for critical pages (Applications, Documents)
- E2E tests with Playwright (stretch goal)

## Open Issues

- Extension must be loaded as unpacked (no Chrome Web Store listing yet)
- WebSocket URL hardcoded to localhost — needs config for production
- No authentication — all API routes open with dev user UUID
