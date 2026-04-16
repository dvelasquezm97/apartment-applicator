# Deployment

> Last updated: 2026-04-16
> Status: PARTIALLY DEPLOYED (Supabase + local Redis live)

## Prerequisites

- Node.js >= 20
- Supabase account (free tier works for development)
- Railway account
- Telegram account (for bot creation)
- Google Cloud Platform account (for Calendar API)
- Anthropic API key

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd apartment-applicator
npm install
npx playwright install chromium
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all required values (see docs/SECURITY.md for full list)
```

### 3. Start services

Terminal 1 — API server:
```bash
npm run dev
```

Terminal 2 — BullMQ workers:
```bash
npm run dev:worker
```

Terminal 3 — Dashboard (Vite dev server):
```bash
npm run dev:web
```

### 4. Local Redis (running)

```bash
# Option A: Docker
docker run -d -p 6379:6379 redis:7

# Option B: Homebrew (macOS) — currently in use
brew install redis && brew services start redis
```

Set `REDIS_URL=redis://localhost:6379` in .env

### 5. Environment variables (optional services)

The following env vars are optional for local development and pilot testing:
- `TELEGRAM_BOT_TOKEN` — not needed until M9
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — not needed until M6
- `ANTHROPIC_API_KEY` — only needed for M4 classifier fallback

## Supabase Setup

### Current Project

- **Project name:** pacific
- **Project ref:** mxovgbinhedtpnczrciy
- **Region:** West EU (Ireland)
- **Account:** Personal (shared project — all tables use `bk_` prefix)
- **URL:** `https://mxovgbinhedtpnczrciy.supabase.co`

### 1. Create project (already done)

- Go to https://supabase.com/dashboard
- Create new project
- Note: Project URL, anon key, service role key

### 2. Run migrations

```bash
# Option A: Supabase CLI
npx supabase link --project-ref mxovgbinhedtpnczrciy
npx supabase db push

# Option B: Manual
# Copy each migration file from supabase/migrations/ into the Supabase SQL editor
# Execute in order: 00001 through 00011
```

**Note:** Migration 00011_dev_seed.sql drops the auth.users FK constraint on bk_users
and inserts a dev user with UUID `00000000-0000-0000-0000-000000000001`. This enables
pilot testing without Supabase Auth configured.

### 3. Create storage buckets

Buckets are created by migration 00010_storage_buckets.sql. Verify in dashboard:
- `user-documents` — private, 10MB max, PDF/JPG/PNG
- `application-screenshots` — private, 5MB max, PNG

### 4. Verify RLS

In Supabase dashboard → Authentication → Policies:
- All tables should show RLS enabled
- Each table should have SELECT, INSERT, UPDATE, DELETE policies

## Railway Deployment

### 1. Create project

- Go to https://railway.app
- New Project → Deploy from GitHub repo
- Connect the repository

### 2. Add Redis

- In project dashboard → New → Redis
- Note the REDIS_URL (auto-injected if you use Railway's variable references)

### 3. Create two services from same repo

**Service 1: API**
- Name: `berlinkeys-api`
- Start command: `npm run start:api`
- Health check: `/health`
- Custom domain (optional): `api.berlinkeys.app`

**Service 2: Worker**
- Name: `berlinkeys-worker`
- Start command: `npm run start:worker`
- No health check path (not an HTTP server)

### 4. Configure environment variables

Set ALL variables from docs/SECURITY.md on BOTH services:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
REDIS_URL=${{Redis.REDIS_URL}}
TELEGRAM_BOT_TOKEN=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.berlinkeys.app/api/auth/google/callback
ANTHROPIC_API_KEY=sk-...
ENCRYPTION_KEY=<64 hex chars>
HEADLESS=true
NODE_ENV=production
```

### 5. Resource config

Both services:
- Memory: 1 GB minimum (Playwright needs ~500MB)
- Railway will auto-scale, but set minimum to avoid OOM

### railway.toml

```toml
[build]
builder = "nixpacks"
buildCommand = "npm ci && npm run build && npm run build:web && npx playwright install chromium --with-deps"

[deploy]
startCommand = "npm run start:api"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

Note: Worker service overrides startCommand to `npm run start:worker` in Railway dashboard.

## Google Calendar OAuth Setup

### 1. GCP Console

- Create project in https://console.cloud.google.com
- Enable Google Calendar API
- Create OAuth 2.0 credentials (Web application)
- Add authorized redirect URI: `https://api.berlinkeys.app/api/auth/google/callback`

### 2. Sequencing Constraint

**IMPORTANT:** The Fastify server must be live and publicly accessible
BEFORE the OAuth callback can work. Sequence:

1. Deploy API service to Railway
2. Verify it's accessible at the public URL
3. Set GOOGLE_REDIRECT_URI to the public callback URL
4. User clicks "Connect Google Calendar" in dashboard
5. OAuth flow redirects back to the live callback URL

### 3. Scopes

Only request: `https://www.googleapis.com/auth/calendar.events`

## Telegram Bot Setup

### 1. Create bot

- Message @BotFather on Telegram
- `/newbot` → follow prompts → get token
- Set TELEGRAM_BOT_TOKEN env var

### 2. Set webhook (production)

After API is deployed:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.berlinkeys.app/webhooks/telegram"}'
```

### 3. Get chat_id

- Start a conversation with the bot
- Send any message
- The bot registers the telegram_chat_id automatically via /start command

## Chrome Extension Distribution

### Local Development (current)

The extension is loaded as an unpacked extension:
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" → select the `extension/` directory
4. Extension icon appears in toolbar — click to see popup with stats

The extension connects to the production Railway WebSocket by default
(`wss://berlinkeys-api-production.up.railway.app/ws`). Override via extension popup settings
or `chrome.storage.local` key `wsUrl`.

### Production Distribution

**Option A: Chrome Web Store (planned)**
- Package extension as `.zip` of the `extension/` directory
- Submit to Chrome Web Store developer dashboard
- Users install with one click
- Requires a $5 developer registration fee

**Option B: Self-hosted .crx**
- Build and sign the extension
- Host `.crx` file on the API server
- Users download and install manually
- Chrome will warn about non-store extensions

### Extension Environment Configuration

The production WebSocket URL is set in `extension/background.ts` (`BK_DEFAULT_WS_URL`).
Current production URL: `wss://berlinkeys-api-production.up.railway.app/ws`.
Users can override via `chrome.storage.local` key `wsUrl`.

**Manifest V3 permissions:** `tabs`, `storage`, `notifications`, `alarms`
- `tabs` — navigate and query Immoscout tabs in background
- `alarms` — keepalive ping every ~24s prevents service worker suspension
- `storage` — persist WS URL and settings
- `notifications` — CAPTCHA alerts

After any change to `extension/*.ts`, recompile:
```bash
cd extension && npx tsc --project tsconfig.json
```
Then reload the extension in Chrome (`chrome://extensions` → reload button).

## Environment Variable Checklist

| Variable | Set in Railway? | Verified? |
|----------|----------------|-----------|
| SUPABASE_URL | [x] | [x] |
| SUPABASE_SERVICE_ROLE_KEY | [x] | [x] |
| SUPABASE_ANON_KEY | [ ] | [ ] |
| REDIS_URL | [x] | [x] |
| TELEGRAM_BOT_TOKEN | [ ] | [ ] |
| GOOGLE_CLIENT_ID | [ ] | [ ] |
| GOOGLE_CLIENT_SECRET | [ ] | [ ] |
| GOOGLE_REDIRECT_URI | [ ] | [ ] |
| ANTHROPIC_API_KEY | [ ] | [ ] |
| ENCRYPTION_KEY | [x] | [x] |
| DAILY_APPLICATION_CAP | [ ] | [ ] (default: 20) |
| NODE_ENV | [x] | [x] (production) |
