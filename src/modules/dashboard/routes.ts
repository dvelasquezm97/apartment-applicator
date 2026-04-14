import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('dashboard:routes');

// TODO: Register dashboard-specific API routes
// Stats, application management, document management, settings

export async function registerDashboardRoutes(server: FastifyInstance): Promise<void> {
  // TODO: Register all dashboard API routes
  throw new Error('Not implemented');
}
