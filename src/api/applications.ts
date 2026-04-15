import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:applications');

export async function registerApplicationRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/applications — list user's applications with listing info
  server.get('/api/applications', async (request) => {
    const userId = getUserId(request);
    const { data, error } = await supabaseAdmin
      .from('applications')
      .select('id, status, retry_count, timeline, created_at, updated_at, listing_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return { applications: [] };

    // Fetch listing info for each application
    const listingIds = [...new Set(data.map((a: any) => a.listing_id))];
    const { data: listings } = await supabaseAdmin
      .from('listings')
      .select('id, title, address, rent, rooms, size, url')
      .in('id', listingIds);

    const listingMap = new Map((listings || []).map((l: any) => [l.id, l]));

    return {
      applications: data.map((a: any) => {
        const listing = listingMap.get(a.listing_id);
        return {
          id: a.id,
          status: a.status,
          retryCount: a.retry_count,
          timeline: a.timeline,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          listing: listing ? {
            id: listing.id,
            title: listing.title,
            address: listing.address,
            rent: listing.rent,
            rooms: listing.rooms,
            size: listing.size,
            url: listing.url,
          } : null,
        };
      }),
    };
  });

  // GET /api/applications/:id — application detail with timeline
  server.get<{ Params: { id: string } }>('/api/applications/:id', async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;

    const { data, error } = await supabaseAdmin
      .from('applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return reply.code(404).send({ error: 'Application not found' });
    }

    // Fetch listing
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', data.listing_id)
      .single();

    return {
      id: data.id,
      status: data.status,
      retryCount: data.retry_count,
      timeline: data.timeline,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      listing: listing ? {
        id: listing.id,
        title: listing.title,
        address: listing.address,
        rent: listing.rent,
        rooms: listing.rooms,
        size: listing.size,
        url: listing.url,
        immoscoutId: listing.immoscout_id,
      } : null,
    };
  });

  // GET /api/applications/:id/messages — messages for an application
  server.get<{ Params: { id: string } }>('/api/applications/:id/messages', async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;

    // Verify application belongs to user
    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!app) {
      return reply.code(404).send({ error: 'Application not found' });
    }

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('id, direction, content, received_at, processed_at')
      .eq('application_id', id)
      .order('received_at', { ascending: true });

    return {
      messages: (messages || []).map((m: any) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        receivedAt: m.received_at,
        processedAt: m.processed_at,
      })),
    };
  });
}

function getUserId(request: any): string {
  return request.headers['x-user-id'] || 'dev-user';
}
