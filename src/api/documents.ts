import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:documents');

export async function registerDocumentRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/documents — list user's documents
  server.get('/api/documents', async (request) => {
    const userId = getUserId(request);
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (error) return { documents: [] };

    return {
      documents: (data || []).map((d: any) => ({
        id: d.id,
        type: d.type,
        filename: d.filename,
        uploadedAt: d.uploaded_at,
      })),
    };
  });

  // POST /api/documents — upload document (multipart)
  server.post<{ Querystring: { type?: string } }>('/api/documents', async (request, reply) => {
    const userId = getUserId(request);
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const docType = (request.query as any).type || 'OTHER';
    const validTypes = ['CV', 'INCOME_PROOF', 'COVER_LETTER', 'SCHUFA', 'OTHER'];
    if (!validTypes.includes(docType)) {
      return reply.code(400).send({ error: `Invalid document type. Must be one of: ${validTypes.join(', ')}` });
    }

    const buffer = await file.toBuffer();
    const storageKey = `${userId}/${docType}/${file.filename}`;

    // Upload to Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('user-documents')
      .upload(storageKey, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (storageError) {
      log.error({ error: storageError.message }, 'Failed to upload to storage');
      return reply.code(500).send({ error: 'Failed to upload file' });
    }

    // Insert document record
    const { data, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: userId,
        type: docType,
        filename: file.filename,
        storage_key: storageKey,
      })
      .select('id')
      .single();

    if (dbError) {
      log.error({ error: dbError.message }, 'Failed to create document record');
      return reply.code(500).send({ error: 'Failed to save document' });
    }

    return { id: data.id, type: docType, filename: file.filename };
  });

  // DELETE /api/documents/:id — delete document
  server.delete<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;

    // Fetch document to get storage key
    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('storage_key')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' });
    }

    // Delete from storage
    await supabaseAdmin.storage.from('user-documents').remove([doc.storage_key]);

    // Delete from DB
    await supabaseAdmin.from('documents').delete().eq('id', id);

    return { success: true };
  });

  // GET /api/documents/:id/url — get signed download URL
  server.get<{ Params: { id: string } }>('/api/documents/:id/url', async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('storage_key, filename')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' });
    }

    const { data } = await supabaseAdmin.storage
      .from('user-documents')
      .createSignedUrl(doc.storage_key, 300);

    if (!data?.signedUrl) {
      return reply.code(500).send({ error: 'Failed to generate download URL' });
    }

    return { url: data.signedUrl, filename: doc.filename };
  });
}

function getUserId(request: any): string {
  return request.headers['x-user-id'] || 'dev-user';
}
