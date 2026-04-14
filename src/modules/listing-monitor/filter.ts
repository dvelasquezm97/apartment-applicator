import { supabaseAdmin } from '../../lib/supabase.js';
import { createChildLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';

const log = createChildLogger('listing-monitor:filter');

export async function canApply(userId: string): Promise<boolean> {
  if (isBlackoutHour()) {
    log.info({ userId }, 'Blackout window active — skipping applications');
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('daily_application_count, daily_application_reset_at, automation_paused')
    .eq('id', userId)
    .single();

  if (error || !data) {
    log.error({ userId, error: error?.message }, 'Failed to fetch user for cap check');
    throw new Error(`Cap check failed: ${error?.message}`);
  }

  if (data.automation_paused) {
    log.info({ userId }, 'Automation paused — skipping');
    return false;
  }

  // Reset daily count if past reset time
  let count = data.daily_application_count ?? 0;
  if (data.daily_application_reset_at) {
    const resetAt = new Date(data.daily_application_reset_at);
    if (resetAt <= new Date()) {
      count = 0;
      await supabaseAdmin
        .from('users')
        .update({
          daily_application_count: 0,
          daily_application_reset_at: getNextResetTime(),
        })
        .eq('id', userId);
      log.info({ userId }, 'Daily application count reset');
    }
  }

  if (count >= env.DAILY_APPLICATION_CAP) {
    log.info({ userId, count, cap: env.DAILY_APPLICATION_CAP }, 'Daily cap reached');
    return false;
  }

  return true;
}

export async function incrementApplicationCount(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('daily_application_count, daily_application_reset_at')
    .eq('id', userId)
    .single();

  const current = data?.daily_application_count ?? 0;
  const update: Record<string, any> = { daily_application_count: current + 1 };

  // Initialize reset timestamp if not set
  if (!data?.daily_application_reset_at) {
    update.daily_application_reset_at = getNextResetTime();
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(update)
    .eq('id', userId);

  if (error) {
    log.error({ userId, error: error.message }, 'Failed to increment application count');
    throw new Error(`Failed to increment count: ${error.message}`);
  }
}

export function isBlackoutHour(now?: Date): boolean {
  const berlinTime = new Date(
    (now ?? new Date()).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }),
  );
  const hour = berlinTime.getHours();
  return hour >= env.APPLY_BLACKOUT_START && hour < env.APPLY_BLACKOUT_END;
}

function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}
