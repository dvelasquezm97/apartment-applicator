import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

export async function registerStatsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/stats — dashboard overview stats
  server.get('/api/stats', async (request) => {
    const userId = getUserId(request);

    // Application counts by status
    const { data: apps } = await supabaseAdmin
      .from('applications')
      .select('status')
      .eq('user_id', userId);

    const statusCounts: Record<string, number> = {};
    for (const app of apps || []) {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
    }

    // Total listings discovered
    const { count: listingCount } = await supabaseAdmin
      .from('listings')
      .select('id', { count: 'exact', head: true });

    // User's daily count and automation state
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('daily_application_count, automation_paused, daily_application_reset_at')
      .eq('id', userId)
      .single();

    // Documents count
    const { count: docCount } = await supabaseAdmin
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Unprocessed messages
    const { count: unprocessedMessages } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null);

    return {
      applications: {
        total: apps?.length || 0,
        byStatus: statusCounts,
      },
      listings: {
        total: listingCount || 0,
      },
      documents: {
        total: docCount || 0,
      },
      daily: {
        applicationsToday: user?.daily_application_count || 0,
        automationPaused: user?.automation_paused || false,
        resetAt: user?.daily_application_reset_at,
      },
      messages: {
        unprocessed: unprocessedMessages || 0,
      },
    };
  });
}

function getUserId(request: any): string {
  return request.headers['x-user-id'] || 'dev-user';
}
