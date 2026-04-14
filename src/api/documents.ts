import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:documents');

export async function registerDocumentRoutes(server: FastifyInstance): Promise<void> {
  // TODO: GET /api/documents — list user's documents
  // TODO: POST /api/documents — upload document (multipart)
  // TODO: DELETE /api/documents/:id — delete document
  // TODO: GET /api/documents/:id/url — get signed download URL
}
