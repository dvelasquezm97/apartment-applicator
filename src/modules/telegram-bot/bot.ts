import { Bot } from 'grammy';
import { env } from '../../config/env.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('telegram-bot');

// TODO: Initialize grammy bot instance
// Webhook mode in production, polling in development

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN ?? 'placeholder');

export async function startBot(): Promise<void> {
  // TODO: Register commands, middleware, start polling or return for webhook
  throw new Error('Not implemented');
}

export async function stopBot(): Promise<void> {
  // TODO: Graceful shutdown
  await bot.stop();
}
