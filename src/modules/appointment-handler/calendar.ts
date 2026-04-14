import type { Appointment } from '../../types/appointment.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('appointment:calendar');

// TODO: Create Google Calendar event via googleapis
// OAuth2 per user, refresh token from Supabase

export async function createCalendarEvent(
  userId: string,
  appointment: Appointment,
): Promise<string> {
  // TODO: Create event, return Google Calendar event ID
  throw new Error('Not implemented');
}
