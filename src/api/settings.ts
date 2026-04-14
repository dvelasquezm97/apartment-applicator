import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('api:settings');

export async function registerSettingsRoutes(server: FastifyInstance): Promise<void> {
  // TODO: GET /api/settings — get user settings + profile
  // TODO: PUT /api/settings — update settings
  // TODO: PUT /api/profile — update user profile
  // TODO: POST /api/auth/google/callback — Google OAuth callback
}
