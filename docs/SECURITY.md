# Security

> Last updated: 2026-04-14
> Status: DESIGNED

## Encryption

### AES-256-GCM for Secrets at Rest

All sensitive user data is encrypted before storage in Supabase:

| Field | Table | What's Encrypted |
|-------|-------|-----------------|
| immoscout_password_encrypted | users | Immoscout24 login password |
| immoscout_cookies_encrypted | users | Serialised browser session cookies |
| google_oauth_tokens | users | Google OAuth2 access + refresh tokens |

**Algorithm:** AES-256-GCM
**Key:** ENCRYPTION_KEY env var (32 bytes, hex-encoded = 64 hex chars)
**IV:** Random 12 bytes generated per encryption, prepended to ciphertext
**Auth tag:** 16 bytes, appended to ciphertext

```
Encrypted format: [IV (12 bytes)][ciphertext][auth tag (16 bytes)]
Stored as: base64-encoded string
```

### Implementation

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

function decrypt(ciphertext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(-16);
  const encrypted = buf.subarray(12, -16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

## Row Level Security (RLS)

Every table has RLS enabled. Pattern:

```sql
CREATE POLICY {table}_select ON public.{table} FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY {table}_insert ON public.{table} FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY {table}_update ON public.{table} FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY {table}_delete ON public.{table} FOR DELETE USING (auth.uid() = user_id);
```

**Exceptions:**
- `users` table: `auth.uid() = id` (not `user_id`)
- `listings` table: shared, SELECT for all authenticated users, mutations via service role only

**Workers:** Always use SUPABASE_SERVICE_ROLE_KEY which bypasses all RLS.

## Supabase Storage: Signed URLs

Documents are stored in private buckets. Never served publicly.

```typescript
// Generate signed URL (5 min expiry)
const { data } = await supabase.storage
  .from('user-documents')
  .createSignedUrl(path, 300); // 300 seconds = 5 minutes
```

**Storage RLS:** File path must start with user's own ID: `{userId}/...`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Admin key (bypasses RLS) — NEVER expose to client |
| SUPABASE_ANON_KEY | Yes | Public key (respects RLS) |
| REDIS_URL | Yes | Redis connection string |
| TELEGRAM_BOT_TOKEN | Yes | From @BotFather |
| GOOGLE_CLIENT_ID | Yes | GCP OAuth2 client ID |
| GOOGLE_CLIENT_SECRET | Yes | GCP OAuth2 client secret |
| GOOGLE_REDIRECT_URI | Yes | OAuth2 callback URL (must match GCP console) |
| ANTHROPIC_API_KEY | Yes | Claude API key |
| ENCRYPTION_KEY | Yes | 64 hex chars = 32 bytes for AES-256 |
| HEADLESS | No | Browser mode: true (default) or false |
| POLL_INTERVAL_MS | No | Listing monitor interval: default 480000 (8 min) |
| BROWSER_POOL_SIZE | No | Max concurrent browsers: default 2 |
| DAILY_APPLICATION_CAP | No | Max applications per day: default 20 |
| APPLY_BLACKOUT_START | No | Hour to stop applying: default 2 (02:00 Berlin) |
| APPLY_BLACKOUT_END | No | Hour to resume applying: default 6 (06:00 Berlin) |

**Rules:**
- Never log env var values
- Never include in error messages or stack traces
- Zod validation at startup — fail fast if required vars missing
- SUPABASE_SERVICE_ROLE_KEY must NEVER be sent to the frontend

## Operational Security

### Rate Limiting

| Control | Value | Configurable |
|---------|-------|-------------|
| Daily application cap | 20 | DAILY_APPLICATION_CAP env var |
| Blackout window | 02:00–06:00 Berlin time | APPLY_BLACKOUT_START/END |
| Poll interval jitter | ±20% | Applied to all repeatable job intervals |
| Inter-application delay | 30s–120s random | Hardcoded in constants |

### Anti-Detection

- All browser actions use randomised delays (see BROWSER_AUTOMATION.md)
- Natural typing speed (character by character with variation)
- Scroll-into-view before click
- Mouse movement via bezier curves
- Timezone set to Europe/Berlin, locale to de-DE
- User-Agent matches real Chrome
- No parallel requests to Immoscout (concurrency: 1 per queue)

### API Rate Limiting

All Fastify endpoints are rate-limited:

```typescript
await server.register(import('@fastify/rate-limit'), {
  max: 100,        // requests per window
  timeWindow: '1 minute',
});
```

## Terms of Service Disclaimer

> **WARNING:** This tool automates interactions with Immoscout24. Automating
> Immoscout24 may violate their Terms of Service. Use at your own risk.
> BerlinKeys is intended for personal use only. The developers assume no
> liability for account suspensions, bans, or other consequences arising
> from the use of this tool.

This disclaimer MUST appear in:
- README.md
- Dashboard Settings page
- First-run setup flow
