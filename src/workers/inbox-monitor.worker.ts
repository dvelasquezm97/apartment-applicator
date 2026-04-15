import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES } from '../config/constants.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { CaptchaDetectedError } from '../lib/errors.js';
import type { InboxMonitorJobData } from '../types/queue.js';
import { runInboxMonitor } from '../modules/inbox-monitor/index.js';

const log = createChildLogger('worker:inbox-monitor');

export function createInboxMonitorWorker(): Worker<InboxMonitorJobData> {
  return new Worker<InboxMonitorJobData>(
    QUEUES.INBOX_MONITOR,
    async (job) => {
      const { userId } = job.data;
      log.info({ userId, jobId: job.id }, 'Starting inbox monitor job');

      // Check if user has paused automation
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('automation_paused')
        .eq('id', userId)
        .single();

      if (user?.automation_paused) {
        log.info({ userId }, 'Automation paused — skipping inbox monitor');
        return { status: 'SKIPPED', reason: 'automation_paused' };
      }

      try {
        const result = await runInboxMonitor(userId);
        log.info({ userId, jobId: job.id, ...result }, 'Inbox monitor job complete');
        return result;
      } catch (err) {
        if (err instanceof CaptchaDetectedError) {
          await supabaseAdmin
            .from('users')
            .update({ automation_paused: true })
            .eq('id', userId);
          log.warn({ userId }, 'CAPTCHA detected — automation paused');
          return { status: 'CAPTCHA', reason: 'automation_paused' };
        }

        log.error({ userId, jobId: job.id, error: (err as Error).message }, 'Inbox monitor job failed');
        throw err;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1,
    },
  );
}
