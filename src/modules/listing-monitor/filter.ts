import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('listing-monitor:filter');

// TODO: Check daily cap and Berlin blackout window (02:00-06:00)

export async function canApply(userId: string): Promise<boolean> {
  // TODO: Check daily_application_count < cap and not in blackout
  throw new Error('Not implemented');
}

export function isBlackoutHour(): boolean {
  // TODO: Check if current Berlin time is between APPLY_BLACKOUT_START and APPLY_BLACKOUT_END
  throw new Error('Not implemented');
}
