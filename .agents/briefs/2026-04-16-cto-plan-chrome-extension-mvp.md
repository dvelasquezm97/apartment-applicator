# CTO Technical Plan: Chrome Extension MVP

**Date:** 2026-04-16
**Ideate brief:** Inline (CTO-initiated based on pilot results)
**COO verdict:** Bypassed — CTO strategic decision after successful pilot
**Paperclip project:** 36f5bfdf-c69b-4a0a-9464-66f884378704
**Paperclip parent issue:** BER-53 (9f8b211a-dac0-484c-93da-30ad2880822b)

## Context

The pilot proved the core loop works: scrape listings → detect already-applied → fill contact form → submit. It runs via Arc CDP in terminal. Now we need to turn this into a product a non-technical user can use. The Chrome Extension architecture was chosen because it's the only approach where Immoscout's bot detection is a non-issue — we run inside the user's real browser.

## Technical Overview

Three components:
1. **Chrome Extension** — thin client in user's browser. Receives commands via WebSocket, executes DOM automation using verified selectors, reports results back.
2. **WebSocket Server** — Fastify plugin on the existing API server. Orchestrates the apply loop, sends commands to the extension, tracks progress.
3. **Dashboard Onboarding** — guided setup flow for a non-technical user: create account → fill profile → paste search URL → install extension → start applying.

## Architecture

```
┌─────────────────────────────────────────┐
│  User's Chrome Browser                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  BerlinKeys Chrome Extension    │   │
│  │  ├── background.ts (service wkr)│   │
│  │  │   └── WebSocket to backend   │   │
│  │  ├── content.ts (DOM automation)│   │
│  │  │   └── Verified selectors     │   │
│  │  └── popup.html (status UI)     │   │
│  └────────────┬────────────────────┘   │
│               │ chrome.tabs API        │
│               │ + content script msgs  │
└───────────────┼─────────────────────────┘
                │ wss://
┌───────────────┼─────────────────────────┐
│  Backend      │                         │
│  ┌────────────┴────────────────────┐   │
│  │  Fastify + WebSocket Plugin     │   │
│  │  ├── /api/* (REST — existing)   │   │
│  │  ├── /ws   (WebSocket — new)    │   │
│  │  │   ├── auth (JWT token)       │   │
│  │  │   ├── commands → extension   │   │
│  │  │   └── results ← extension   │   │
│  │  └── Orchestrator               │   │
│  │      ├── Scrape search URL      │   │
│  │      ├── Filter (already applied│   │
│  │      │   + daily cap + dedup)   │   │
│  │      ├── Apply loop             │   │
│  │      └── Progress events → dash │   │
│  └─────────────────────────────────┘   │
│               │                         │
│  ┌────────────┴────────────────────┐   │
│  │  React Dashboard (existing)     │   │
│  │  + Onboarding wizard (new)      │   │
│  │  + Live apply feed (new)        │   │
│  │  + Extension install page (new) │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Pipeline Stages

| Stage | Status | Skill | Justification |
|-------|--------|-------|---------------|
| 1. Design | APPLY | /design-shotgun | Non-technical user needs polished onboarding. Extension popup needs clean UI. |
| 2. Architecture | APPLY | /arch-review | New component (extension) + WebSocket layer + auth — multi-system integration |
| 3. Build | APPLY | Claude direct | Always |
| 4. Compliance | APPLY | /compliance-check | User credentials flow through extension, personal data in forms, auth tokens |
| 5. Code Review | APPLY | /review + /codex | Always |
| 6. Ship | APPLY | /ship | Always |
| 7. Deploy | APPLY | /safe-deploy | First production deployment — dashboard + API need hosting |
| 8. Documentation | APPLY | /update-docs | Always |

All 8 stages apply. This is the first user-facing release.

## Implementation Phases

### Phase 1: Extension + WebSocket (backend-first)

**Goal:** Extension can connect to backend, receive "apply to this listing" command, execute it in user's browser, report success/failure.

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/api/ws.ts` | CREATE | WebSocket server plugin — auth, connection mgmt, command dispatch |
| 2 | `src/orchestrator/apply-loop.ts` | CREATE | Orchestrator — fetch search URL, filter, queue apply commands |
| 3 | `src/orchestrator/types.ts` | CREATE | Shared types for WS messages (commands + events) |
| 4 | `src/index.ts` | MODIFY | Register WS plugin |
| 5 | `extension/manifest.json` | CREATE | Manifest V3 — permissions for immobilienscout24.de |
| 6 | `extension/background.ts` | CREATE | Service worker — WS connection, message routing |
| 7 | `extension/content.ts` | CREATE | Content script — DOM selectors, form fill, click, report |
| 8 | `extension/popup.html` | CREATE | Popup UI — connection status, start/stop, apply count |
| 9 | `extension/popup.ts` | CREATE | Popup logic — communicates with background |
| 10 | `extension/icons/` | CREATE | Extension icons (16, 48, 128px) |

### Phase 2: Dashboard Onboarding + Live Feed

**Goal:** Non-technical user can sign up, set up profile, paste their search URL, and see applications happening in real-time.

| # | File | Action | Description |
|---|------|--------|-------------|
| 11 | `web/src/pages/Onboarding.tsx` | CREATE | Step-by-step wizard: account → profile → search → extension |
| 12 | `web/src/pages/LiveFeed.tsx` | CREATE | Real-time apply progress via WebSocket |
| 13 | `web/src/components/ExtensionInstall.tsx` | CREATE | Download link + visual install instructions |
| 14 | `web/src/hooks/useWebSocket.ts` | CREATE | React hook for WS connection + events |
| 15 | `web/src/pages/Settings.tsx` | MODIFY | Add search URL field, move profile fields to onboarding |
| 16 | `src/api/settings.ts` | MODIFY | Add search_url to user settings |
| 17 | `supabase/migrations/00012_add_search_url.sql` | CREATE | Add search_url column to bk_users |

### Phase 3: Auth + Deploy

**Goal:** Deployed and shareable. User signs up with email, gets magic link, can start using.

| # | File | Action | Description |
|---|------|--------|-------------|
| 18 | `src/api/auth.ts` | CREATE | Supabase Auth routes — signup, login, magic link, session |
| 19 | `src/middleware/auth.ts` | CREATE | JWT verification middleware replacing dev-user UUID |
| 20 | `web/src/pages/Login.tsx` | CREATE | Login page with magic link |
| 21 | `web/src/hooks/useAuth.ts` | MODIFY | Wire up real Supabase Auth |
| 22 | `Dockerfile` | CREATE | Multi-stage build for API server |
| 23 | `railway.toml` | CREATE | Railway deployment config |
| 24 | `vercel.json` | CREATE | Vercel config for dashboard |

## Data Model Changes

```sql
-- 00012_add_search_url.sql
ALTER TABLE public.bk_users ADD COLUMN search_url text;
ALTER TABLE public.bk_users ADD COLUMN onboarding_complete boolean DEFAULT false;
```

## API Changes

| Method | Path | Change |
|--------|------|--------|
| GET | `/ws` | NEW — WebSocket upgrade endpoint |
| PUT | `/api/settings` | MODIFY — accept search_url field |
| POST | `/api/auth/signup` | NEW — email signup |
| POST | `/api/auth/login` | NEW — magic link login |
| GET | `/api/auth/session` | NEW — session check |
| POST | `/api/apply/start` | NEW — trigger apply loop |
| POST | `/api/apply/stop` | NEW — stop apply loop |
| GET | `/api/apply/status` | NEW — current apply status |

## WebSocket Protocol

```typescript
// Backend → Extension (commands)
{ type: 'navigate', url: string }
{ type: 'scrape-listings', selectors: {...} }
{ type: 'apply-to-listing', listingUrl: string, profile: {...} }
{ type: 'check-result' }

// Extension → Backend (events)
{ type: 'connected', tabId: number }
{ type: 'listings-scraped', listings: Listing[] }
{ type: 'apply-started', listingId: string }
{ type: 'apply-success', listingId: string }
{ type: 'apply-failed', listingId: string, reason: string }
{ type: 'captcha-detected' }

// Backend → Dashboard (progress)
{ type: 'progress', applied: number, total: number, current: string }
{ type: 'listing-result', listingId: string, status: 'success' | 'failed' | 'skipped' }
```

## Test Strategy

- **Extension:** Manual testing in Chrome (extensions can't be unit tested easily)
- **WebSocket server:** Unit tests with mock WS client
- **Orchestrator:** Unit tests with mock extension responses
- **Dashboard:** Manual testing of onboarding flow + live feed
- **Integration:** Full E2E test using the pilot script approach (Arc CDP)

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Immoscout changes selectors again | Selectors centralized in `selectors.ts`, extension fetches latest from backend on connect |
| Extension gets flagged by Chrome | Extension does minimal work (just DOM ops), no suspicious API calls. If flagged, can distribute as .crx sideload |
| User closes browser mid-apply | Orchestrator tracks state, resumes on next connection |
| Rate limiting / IP bans | Human delays between applications (30-60s), daily cap, configurable |
| Non-technical user confusion | Step-by-step onboarding with screenshots, minimal decisions required |
| Cookies/session expire | Extension runs in user's logged-in browser — no cookie management needed |

## User Journey (non-technical user)

1. Receives link from David: `berlinkeys.app`
2. Clicks "Get Started" → enters email → receives magic link
3. Fills profile: name, phone, address, occupation, income
4. Pastes their Immoscout search URL (with instructions + screenshot)
5. Clicks "Install Extension" → Chrome Web Store or direct download
6. Extension shows green "Connected" badge
7. Clicks "Start Applying" on dashboard
8. Watches live feed: "Applying to 2-Zimmer in Wedding... ✅ Sent!"
9. Gets email/Telegram when landlord responds

## Build Order

1. **Phase 1** first — get extension + WebSocket working. This is the core value.
2. **Phase 2** next — onboarding + live feed. This makes it usable by non-technical users.
3. **Phase 3** last — auth + deploy. This makes it shareable.

Each phase is independently testable. Phase 1 can be tested locally. Phase 2 adds the UI. Phase 3 ships it.

## Estimated scope

- Phase 1: ~10 files, ~1500 lines
- Phase 2: ~7 files, ~800 lines
- Phase 3: ~7 files, ~500 lines
- Total: ~24 files, ~2800 lines
