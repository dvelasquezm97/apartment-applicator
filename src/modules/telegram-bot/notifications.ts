import type { TelegramNotification } from '../../types/notification.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('telegram-bot:notifications');

// TODO: Send outbound notifications to users via Telegram
// Called by other modules when events occur

export async function sendNotification(notification: TelegramNotification): Promise<void> {
  // TODO: Look up telegram_chat_id, send message (with optional screenshot)
  throw new Error('Not implemented');
}

export async function askPendingQuestion(
  userId: string,
  applicationId: string,
  fieldName: string,
  fieldLabel: string,
): Promise<void> {
  // TODO: Create bot_session, send question, wait for reply or timeout
  throw new Error('Not implemented');
}
