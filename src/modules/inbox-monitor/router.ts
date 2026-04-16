import type { InboxMessage, ClassificationResult, MessageIntent } from '../../types/message.js';
import { createChildLogger } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { transition } from '../../lib/state-machine.js';
import { documentSenderQueue, appointmentQueue, externalFormQueue } from '../../lib/queue.js';

const log = createChildLogger('inbox-monitor:router');

/** Map of intents to the application status transitions they trigger.
 * `from` is an array of valid source states — the transition only fires if the
 * application is currently in one of those states. */
const INTENT_STATUS_MAP: Partial<Record<MessageIntent, { from: string[]; to: string }>> = {
  DOCUMENT_REQUEST: { from: ['APPLIED'], to: 'DOCUMENTS_REQUESTED' },
  VIEWING_INVITE: { from: ['APPLIED', 'DOCUMENTS_SENT'], to: 'VIEWING_INVITED' },
  EXTERNAL_FORM: { from: ['APPLIED'], to: 'EXTERNAL_FORM_DETECTED' },
};

/**
 * Route a classified message to the appropriate downstream handler queue.
 * Inserts the message into the DB, transitions application status, and enqueues the job.
 */
export async function routeMessage(
  message: InboxMessage,
  classification: ClassificationResult,
  userId: string,
): Promise<void> {
  log.info({ applicationId: message.applicationId, intent: classification.intent }, 'Routing message');

  // 1. Insert message WITHOUT processed_at — only mark processed after routing succeeds
  const messageId = await insertMessage(message, false);

  try {
    // 2. Enqueue downstream job and transition status based on intent
    switch (classification.intent) {
    case 'DOCUMENT_REQUEST': {
      const trans = INTENT_STATUS_MAP['DOCUMENT_REQUEST'];
      if (trans) await transitionApplicationStatus(message.applicationId, trans, classification);
      await documentSenderQueue.add(
        `docs:${message.applicationId}`,
        { userId, applicationId: message.applicationId, messageId },
      );
      log.info({ applicationId: message.applicationId }, 'Enqueued document-sender job');
      break;
    }

    case 'VIEWING_INVITE': {
      const trans = INTENT_STATUS_MAP['VIEWING_INVITE'];
      if (trans) await transitionApplicationStatus(message.applicationId, trans, classification);
      await appointmentQueue.add(
        `appt:${message.applicationId}`,
        { userId, applicationId: message.applicationId, messageId },
      );
      log.info({ applicationId: message.applicationId }, 'Enqueued appointment job');
      break;
    }

    case 'EXTERNAL_FORM': {
      const formUrl = extractFormUrl(message.content);
      if (formUrl) {
        const trans = INTENT_STATUS_MAP['EXTERNAL_FORM'];
        if (trans) await transitionApplicationStatus(message.applicationId, trans, classification);
        await externalFormQueue.add(
          `form:${message.applicationId}`,
          { userId, applicationId: message.applicationId, formUrl },
        );
        log.info({ applicationId: message.applicationId, formUrl }, 'Enqueued external-form job');
      } else {
        // No URL found — don't transition status without actionable data
        log.warn({ applicationId: message.applicationId }, 'EXTERNAL_FORM classified but no URL found — treating as GENERIC');
      }
      break;
    }

    case 'REJECTION':
      // No downstream queue — just log and close the application
      await closeApplication(message.applicationId, 'Rejection received from landlord');
      break;

    case 'GENERIC':
      // No downstream action — message is stored for reference
      log.debug({ applicationId: message.applicationId }, 'Generic message stored, no action needed');
      break;
    }

    // 4. Mark message as processed only after all routing succeeded
    await markMessageProcessed(messageId);
  } catch (err) {
    log.error({ messageId, error: (err as Error).message }, 'Routing failed — message left unprocessed for retry');
    throw err;
  }
}

/**
 * Insert a message into the messages table. Returns the DB-generated ID.
 * When markProcessed is false, processed_at is left null so the message
 * can be retried if downstream routing fails.
 */
async function insertMessage(message: InboxMessage, markProcessed: boolean): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('bk_messages')
    .insert({
      application_id: message.applicationId,
      direction: message.direction,
      content: message.content,
      received_at: message.receivedAt,
      processed_at: markProcessed ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) {
    log.error({ error: error.message }, 'Failed to insert message');
    throw error;
  }

  return data.id;
}

/**
 * Mark a message as processed after routing succeeds.
 */
async function markMessageProcessed(messageId: string): Promise<void> {
  await supabaseAdmin
    .from('bk_messages')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', messageId);
}

/**
 * Transition application status via the state machine.
 * Silently handles cases where the transition is invalid (e.g. already past this state).
 */
async function transitionApplicationStatus(
  applicationId: string,
  mapping: { from: string[]; to: string },
  classification: ClassificationResult,
): Promise<void> {
  const { data: app } = await supabaseAdmin
    .from('bk_applications')
    .select('status, retry_count, timeline')
    .eq('id', applicationId)
    .single();

  if (!app) return;

  // Only transition if the application is in one of the expected source states
  if (!mapping.from.includes(app.status)) {
    log.debug({ applicationId, currentStatus: app.status, expectedFrom: mapping.from }, 'Application not in expected state — skipping transition');
    return;
  }

  const to = mapping.to;

  try {
    const result = transition(app.status, to as any, app.retry_count || 0, `${classification.intent}: ${classification.reasoning}`);
    const timeline = (app.timeline as any[]) || [];
    timeline.push(result.timelineEntry);

    await supabaseAdmin
      .from('bk_applications')
      .update({ status: result.newStatus, timeline })
      .eq('id', applicationId);
  } catch (err) {
    log.warn({ applicationId, error: (err as Error).message }, 'Status transition failed');
  }
}

/**
 * Close an application (e.g. on rejection).
 */
async function closeApplication(applicationId: string, note: string): Promise<void> {
  const { data: app } = await supabaseAdmin
    .from('bk_applications')
    .select('status, timeline')
    .eq('id', applicationId)
    .single();

  if (!app) return;

  const timeline = (app.timeline as any[]) || [];
  timeline.push({ status: 'CLOSED', timestamp: new Date().toISOString(), note });

  await supabaseAdmin
    .from('bk_applications')
    .update({ status: 'CLOSED', timeline })
    .eq('id', applicationId);

  log.info({ applicationId, note }, 'Application closed');
}

/**
 * Extract the first URL from message content (for external form routing).
 */
function extractFormUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[^\s)]+/);
  return match ? match[0]! : null;
}
