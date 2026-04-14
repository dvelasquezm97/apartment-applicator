import type { Context } from 'grammy';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('telegram-bot:commands');

// TODO: Command handlers for /status, /pause, /resume, /screenshot, /health

export async function handleStatus(ctx: Context): Promise<void> {
  // TODO: Query active applications, send summary
  throw new Error('Not implemented');
}

export async function handlePause(ctx: Context): Promise<void> {
  // TODO: Set automation_paused = true, pause repeatable jobs
  throw new Error('Not implemented');
}

export async function handleResume(ctx: Context): Promise<void> {
  // TODO: Set automation_paused = false, re-register repeatables, reset circuit breaker
  throw new Error('Not implemented');
}

export async function handleScreenshot(ctx: Context): Promise<void> {
  // TODO: Capture browser screenshot, send as photo
  throw new Error('Not implemented');
}

export async function handleHealth(ctx: Context): Promise<void> {
  // TODO: Check Redis + Supabase + browser sessions, send status
  throw new Error('Not implemented');
}
