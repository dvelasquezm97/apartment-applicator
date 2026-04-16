import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';
import { encrypt } from '../lib/encryption.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:settings');

export async function registerSettingsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/settings — user settings + profile (no auth for now)
  server.get('/api/settings', async (request, reply) => {
    const userId = getUserId(request);
    const { data, error } = await supabaseAdmin
      .from('bk_users')
      .select('id, immoscout_email, profile, automation_paused, daily_application_count, daily_application_reset_at, telegram_chat_id, search_url, onboarding_complete, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return {
      id: data.id,
      immoscoutEmail: data.immoscout_email,
      hasPassword: true, // Never expose actual password
      profile: data.profile,
      automationPaused: data.automation_paused,
      dailyApplicationCount: data.daily_application_count,
      telegramChatId: data.telegram_chat_id,
      searchUrl: data.search_url,
      onboardingComplete: data.onboarding_complete,
      createdAt: data.created_at,
    };
  });

  // PUT /api/settings — update Immoscout credentials + automation toggle
  server.put<{ Body: { immoscoutEmail?: string; immoscoutPassword?: string; automationPaused?: boolean; searchUrl?: string; onboardingComplete?: boolean } }>(
    '/api/settings',
    async (request, reply) => {
      const userId = getUserId(request);
      const { immoscoutEmail, immoscoutPassword, automationPaused, searchUrl, onboardingComplete } = request.body;

      const updates: Record<string, any> = {};
      if (immoscoutEmail !== undefined) updates.immoscout_email = immoscoutEmail;
      if (immoscoutPassword !== undefined) {
        updates.immoscout_password_encrypted = encrypt(immoscoutPassword);
      }
      if (automationPaused !== undefined) updates.automation_paused = automationPaused;
      if (searchUrl !== undefined) updates.search_url = searchUrl;
      if (onboardingComplete !== undefined) updates.onboarding_complete = onboardingComplete;

      const { error } = await supabaseAdmin
        .from('bk_users')
        .update(updates)
        .eq('id', userId);

      if (error) {
        log.error({ error: error.message }, 'Failed to update settings');
        return reply.code(500).send({ error: 'Failed to update settings' });
      }

      return { success: true };
    },
  );

  // PUT /api/settings/profile — update user profile fields
  server.put<{ Body: Record<string, any> }>(
    '/api/settings/profile',
    async (request, reply) => {
      const userId = getUserId(request);

      // Merge with existing profile
      const { data: user } = await supabaseAdmin
        .from('bk_users')
        .select('profile')
        .eq('id', userId)
        .single();

      const existingProfile = (user?.profile as Record<string, any>) || {};
      const mergedProfile = { ...existingProfile, ...request.body };

      const { error } = await supabaseAdmin
        .from('bk_users')
        .update({ profile: mergedProfile })
        .eq('id', userId);

      if (error) {
        return reply.code(500).send({ error: 'Failed to update profile' });
      }

      return { success: true, profile: mergedProfile };
    },
  );
}

/**
 * Temporary: hardcoded user ID until auth is implemented.
 * Replace with JWT-based user extraction later.
 */
function getUserId(request: any): string {
  // Check X-User-Id header for development, or use first user in DB
  return request.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001';
}
