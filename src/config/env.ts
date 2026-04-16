import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Redis
  REDIS_URL: z.string().min(1),

  // Telegram (optional until M9)
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Google Calendar OAuth2 (optional until M6)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // Claude API (optional — M4 classifier falls back to rules-only without it)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Encryption (64 hex chars = 32 bytes)
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-fA-F]+$/),

  // Browser automation
  HEADLESS: z.string().default('true'),
  BROWSER_POOL_SIZE: z.coerce.number().int().min(1).max(10).default(2),

  // Application limits
  POLL_INTERVAL_MS: z.coerce.number().int().min(60000).default(480000),
  DAILY_APPLICATION_CAP: z.coerce.number().int().min(1).max(100).default(20),
  APPLY_BLACKOUT_START: z.coerce.number().int().min(0).max(23).default(2),
  APPLY_BLACKOUT_END: z.coerce.number().int().min(0).max(23).default(6),

  // Server
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
