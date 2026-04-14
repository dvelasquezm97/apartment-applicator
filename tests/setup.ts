// Global vitest setup
// Env vars must be set at top level BEFORE any module imports trigger env validation

process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex for testing
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
