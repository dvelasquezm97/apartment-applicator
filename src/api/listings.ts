import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

export async function registerListingRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/listings — list discovered listings
  server.get('/api/listings', async () => {
    const { data } = await supabaseAdmin
      .from('listings')
      .select('id, immoscout_id, url, title, address, rent, size, rooms, status, discovered_at')
      .order('discovered_at', { ascending: false })
      .limit(100);

    return {
      listings: (data || []).map((l: any) => ({
        id: l.id,
        immoscoutId: l.immoscout_id,
        url: l.url,
        title: l.title,
        address: l.address,
        rent: l.rent,
        size: l.size,
        rooms: l.rooms,
        status: l.status,
        discoveredAt: l.discovered_at,
      })),
    };
  });

  // GET /api/listings/:id — listing detail
  server.get<{ Params: { id: string } }>('/api/listings/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return reply.code(404).send({ error: 'Listing not found' });
    }

    return {
      id: data.id,
      immoscoutId: data.immoscout_id,
      url: data.url,
      title: data.title,
      address: data.address,
      rent: data.rent,
      size: data.size,
      rooms: data.rooms,
      status: data.status,
      discoveredAt: data.discovered_at,
    };
  });
}
