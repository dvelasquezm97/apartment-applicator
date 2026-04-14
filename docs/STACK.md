# Stack

> Last updated: 2026-04-14
> Status: FINAL

## Runtime & Language

| Component | Choice | Version |
|-----------|--------|---------|
| Runtime | Node.js | >= 20.0.0 |
| Language | TypeScript | ^5.7.0 |
| Module system | ESM (NodeNext) | — |

**Rationale:** Node.js 20+ for native fetch, stable ESM, and top-level await. TypeScript
in strict mode for type safety across all 10 modules. ESM over CommonJS for tree-shaking
and modern import syntax.

## Backend

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| HTTP framework | Fastify | ^5.x | Schema-based validation, built-in TypeScript, 2x Express throughput, plugin system for clean module boundaries |
| CORS | @fastify/cors | ^11.x | Required for dashboard dev proxy |
| Security headers | @fastify/helmet | ^13.x | Sane security defaults |
| File uploads | @fastify/multipart | ^10.x | Document upload handling |
| Static files | @fastify/static | ^9.x | Serve built dashboard in production |
| Auth | @fastify/jwt | ^10.x | JWT verification for API routes |

## Database, Auth & Storage

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Database | Supabase (PostgreSQL) | Built-in Auth, RLS for multi-tenant safety, Realtime for dashboard |
| Auth | Supabase Auth | Magic link for dashboard, JWT sessions, no custom auth code |
| Storage | Supabase Storage | Private buckets, signed URLs, integrated with Auth RLS |
| Client | @supabase/supabase-js ^2.x | Two clients: admin (service_role, bypasses RLS for workers) and anon (dashboard) |

## Job Queue

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Queue | BullMQ ^5.x | Redis-backed durability, repeatable jobs, exponential backoff, DLQ, rate limiting |
| Redis client | ioredis ^5.x | Required by BullMQ, connection pooling |
| Queue UI | Bull Board | Mounted at /admin/queues, job inspection |
| Job config | removeOnComplete: false, removeOnFail: false | Jobs always inspectable for debugging |

**Queue topology:**
- `listing-monitor` — repeatable, ~8 min + jitter
- `auto-apply` — event-driven, triggered by listing-monitor
- `inbox-monitor` — repeatable, ~5 min + jitter
- `document-sender` — event-driven, triggered by inbox classifier
- `appointment` — event-driven, triggered by inbox classifier
- `external-form` — event-driven, triggered by inbox classifier
- `reconciliation` — runs once on worker startup

## Browser Automation

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Browser control | playwright-core ^1.x | Multi-browser support, auto-wait, trace viewer, network interception |
| Stealth wrapper | playwright-extra ^4.x | Wraps playwright-core, enables stealth plugins |
| Anti-detection | puppeteer-extra-plugin-stealth ^2.x | Evades navigator.webdriver, WebGL fingerprint, timezone detection |
| Browser | Chromium only | Installed via `npx playwright install chromium` to save ~300MB |

## Integrations

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Telegram | grammy ^1.x | Better TypeScript than Telegraf, middleware composition, session mgmt |
| Google Calendar | googleapis ^171.x | Official SDK, OAuth2 built-in, token refresh |
| AI (form analysis) | @anthropic-ai/sdk ^0.x | Claude API for external form field analysis and mapping |

## Observability

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Logging | pino ^10.x | Structured JSON, 5x faster than Winston, child logger pattern |
| Dev logging | pino-pretty ^13.x | Human-readable dev output |

## Frontend

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | React ^19.x | Ecosystem, component model, hooks |
| Build tool | Vite ^6.x | Fast HMR, native ESM, simple config |
| Routing | react-router-dom ^7.x | Standard React routing |
| Data fetching | @tanstack/react-query ^5.x | Caching, refetching, optimistic updates |
| Styling | Tailwind CSS ^4.x | Utility-first, fast iteration |

## Validation

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Schema validation | zod ^3.x | Runtime validation for env vars, API payloads, form data |
| Env loading | dotenv ^16.x | Load .env in development |

## Deployment

| Component | Choice | Config |
|-----------|--------|--------|
| Platform | Railway | Two services: API + Worker |
| API service | `npm run start:api` | 1GB RAM min |
| Worker service | `npm run start:worker` | 1GB RAM min |
| Redis | Railway Redis plugin | Shared by both services |
| Build | nixpacks | Auto-detected Node.js |

## gstack Evaluation

**Result:** SKIP — not applicable. See docs/DECISIONS.md for full rationale.
