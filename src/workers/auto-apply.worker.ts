import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { QUEUES, DELAYS } from '../config/constants.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { transition } from '../lib/state-machine.js';
import { CaptchaDetectedError } from '../lib/errors.js';
import { autoApplyQueue } from '../lib/queue.js';
import type { AutoApplyJobData } from '../types/queue.js';
import { applyToListing } from '../modules/auto-apply/index.js';
import { MAX_RETRY_COUNT } from '../types/application.js';

const log = createChildLogger('worker:auto-apply');

export function createAutoApplyWorker(): Worker<AutoApplyJobData> {
  return new Worker<AutoApplyJobData>(
    QUEUES.AUTO_APPLY,
    async (job) => {
      const { userId, listingId, applicationId } = job.data;
      log.info({ userId, listingId, applicationId, jobId: job.id, attempt: job.attemptsMade + 1 }, 'Processing auto-apply job');

      // Check if user has paused automation — transition to FAILED so it's not stuck in APPLYING
      const paused = await isAutomationPaused(userId);
      if (paused) {
        log.info({ userId, applicationId }, 'Automation paused for user — marking FAILED');
        const { data: app } = await supabaseAdmin
          .from('applications')
          .select('retry_count, timeline')
          .eq('id', applicationId)
          .single();
        const timeline = (app?.timeline as any[]) || [];
        timeline.push({ status: 'FAILED', timestamp: new Date().toISOString(), note: 'Skipped: automation paused' });
        await supabaseAdmin
          .from('applications')
          .update({ status: 'FAILED', timeline })
          .eq('id', applicationId);
        return { status: 'SKIPPED', reason: 'automation_paused' };
      }

      try {
        const result = await applyToListing(userId, listingId, applicationId);

        // On FAILED, handle retry logic: re-enqueue a new job or close
        if (result.status === 'FAILED') {
          const retried = await handleRetry(applicationId, userId, listingId);
          if (!retried) {
            log.info({ applicationId }, 'Max retries reached — application closed');
          }
        }

        log.info({ userId, listingId, applicationId, jobId: job.id, ...result }, 'Auto-apply job complete');
        return result;
      } catch (err) {
        if (err instanceof CaptchaDetectedError) {
          // Pause all automation for this user
          await pauseAutomation(userId, 'CAPTCHA detected');
          log.warn({ userId }, 'CAPTCHA detected — automation paused for user');
          // Don't retry CAPTCHA jobs — requires manual intervention
          return { status: 'CAPTCHA', reason: 'automation_paused' };
        }

        log.error({ userId, listingId, applicationId, jobId: job.id, error: (err as Error).message }, 'Auto-apply job failed');
        throw err; // Let BullMQ handle retry via job options
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1, // Serialized to avoid detection
      limiter: {
        max: 1,
        duration: DELAYS.BETWEEN_APPLICATIONS.min, // Minimum delay between jobs
      },
    },
  );
}

/**
 * Check if the user has paused automation.
 */
async function isAutomationPaused(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('automation_paused')
    .eq('id', userId)
    .single();
  return data?.automation_paused === true;
}

/**
 * Pause all automation for a user (e.g. on CAPTCHA detection).
 */
async function pauseAutomation(userId: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({ automation_paused: true })
    .eq('id', userId);
  log.info({ userId, reason }, 'Automation paused');
}

/**
 * Handle retry logic: FAILED → APPLYING if retries remain, else CLOSED.
 * Re-enqueues a new BullMQ job with delay for the retry attempt.
 * Returns true if a retry was enqueued, false if max retries reached.
 */
async function handleRetry(applicationId: string, userId: string, listingId: string): Promise<boolean> {
  const { data: app } = await supabaseAdmin
    .from('applications')
    .select('retry_count, timeline')
    .eq('id', applicationId)
    .single();

  const retryCount = app?.retry_count || 0;

  if (retryCount >= MAX_RETRY_COUNT) {
    // Max retries exceeded — close the application
    const timeline = (app?.timeline as any[]) || [];
    timeline.push({ status: 'CLOSED', timestamp: new Date().toISOString(), note: `Max retries (${MAX_RETRY_COUNT}) exceeded` });
    await supabaseAdmin
      .from('applications')
      .update({ status: 'CLOSED', timeline })
      .eq('id', applicationId);
    return false;
  }

  // Transition FAILED → APPLYING for retry
  try {
    const result = transition('FAILED', 'APPLYING', retryCount, `Retry ${retryCount + 1}/${MAX_RETRY_COUNT}`);
    const timeline = (app?.timeline as any[]) || [];
    timeline.push(result.timelineEntry);
    await supabaseAdmin
      .from('applications')
      .update({ status: result.newStatus, retry_count: result.retryCount, timeline })
      .eq('id', applicationId);

    // Re-enqueue a new job with exponential backoff delay
    const backoffDelay = 5000 * Math.pow(2, retryCount); // 5s, 10s, 20s
    await autoApplyQueue.add(
      `retry:${applicationId}`,
      { userId, listingId, applicationId },
      { delay: backoffDelay },
    );
    log.info({ applicationId, retryCount: retryCount + 1, backoffDelay }, 'Retry job enqueued');

    return true;
  } catch (err) {
    log.error({ applicationId, error: (err as Error).message }, 'Failed to enqueue retry');
    return false;
  }
}
