# Deployment

> Last updated: 2026-04-14
> Status: DESIGNED

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

### 4. Local Redis

```bash
# Option A: Docker
docker run -d -p 6379:6379 redis:7

# Option B: Homebrew (macOS)
brew install redis && brew services start redis
```

Set `REDIS_URL=redis://localhost:6379` in .env

## Supabase Setup

### 1. Create project

- Go to https://supabase.com/dashboard
- Create new project
- Note: Project URL, anon key, service role key

### 2. Run migrations

```bash
# Option A: Supabase CLI
npx supabase link --project-ref <project-ref>
npx supabase db push

# Option B: Manual
# Copy each migration file from supabase/migrations/ into the Supabase SQL editor
# Execute in order: 00001 through 00010
```

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

## Environment Variable Checklist

| Variable | Set in Railway? | Verified? |
|----------|----------------|-----------|
| SUPABASE_URL | [ ] | [ ] |
| SUPABASE_SERVICE_ROLE_KEY | [ ] | [ ] |
| SUPABASE_ANON_KEY | [ ] | [ ] |
| REDIS_URL | [ ] | [ ] |
| TELEGRAM_BOT_TOKEN | [ ] | [ ] |
| GOOGLE_CLIENT_ID | [ ] | [ ] |
| GOOGLE_CLIENT_SECRET | [ ] | [ ] |
| GOOGLE_REDIRECT_URI | [ ] | [ ] |
| ANTHROPIC_API_KEY | [ ] | [ ] |
| ENCRYPTION_KEY | [ ] | [ ] |
| HEADLESS | [ ] | [ ] |
| NODE_ENV | [ ] | [ ] |
