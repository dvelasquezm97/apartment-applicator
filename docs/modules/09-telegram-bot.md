# Module 9: Telegram Bot

> Last updated: 2026-04-14
> Status: NOT_STARTED

## Purpose

Provide real-time notifications and user interaction via a Telegram bot.
Handles event notifications from all modules, stateful pending question
conversations, and user commands.

## Key Files

| File | Responsibility |
|------|---------------|
| src/modules/telegram-bot/index.ts | Module exports, bot lifecycle |
| src/modules/telegram-bot/bot.ts | grammy.js bot instance, middleware, webhook/polling setup |
| src/modules/telegram-bot/commands.ts | Command handlers: /status, /pause, /resume, /screenshot, /health |
| src/modules/telegram-bot/notifications.ts | Outbound notification sender (called by other modules) |

## Inputs

- TELEGRAM_BOT_TOKEN env var
- User's `telegram_chat_id` from Supabase
- Events from all other modules (via direct function calls or queue events)
- User replies for pending questions

## Outputs

- Notifications sent to user's Telegram chat
- Command responses
- Pending question answers → update `pending_questions` + `bot_sessions` → resume jobs

## Dependencies

- None (foundational — other modules call this module's notification functions)

## Commands

| Command | Action |
|---------|--------|
| /status | Active applications summary with status counts |
| /pause | Set `automation_paused = true`, pause all repeatable jobs |
| /resume | Set `automation_paused = false`, re-register repeatables, reset circuit breaker |
| /screenshot | Take current browser screenshot, send as photo |
| /health | Check Redis + Supabase + browser sessions, return status |

## Notification Types

- New listing found (Module 2)
- Application submitted successfully (Module 3)
- Application failed (Module 3)
- Documents requested by landlord (Module 4)
- Documents sent (Module 5)
- Viewing invitation received (Module 6)
- Viewing scheduled + calendar event created (Module 6)
- External form detected (Module 7)
- Pending question for user input (Module 7)
- External form submitted (Module 7)
- Daily cap reached (Module 2)
- Circuit breaker triggered (Module 1)
- CAPTCHA detected with screenshot (Module 1)
- Health check failure

## Stateful Conversation: Pending Questions

1. Module 7 calls `askPendingQuestion(userId, question)` → sends Telegram message
2. Bot stores conversation state in `bot_sessions` table
3. User's next text reply is matched to the active `bot_session`
4. Answer is stored in `pending_questions.answer`, `answered_at` set
5. BullMQ job resumed with the answer
6. If no reply within 24h: `timed_out_at` set, job resumed with blank, user notified

**Conflict handling:** Only one active `bot_session` per user. If a second question
arrives while one is pending, queue it — process after first is answered or times out.

## Webhook vs Polling

- **Production:** Webhook mode — Fastify route at `/webhooks/telegram`
- **Development:** Polling mode — `bot.start()` with long polling
- Determined by `NODE_ENV` env var

## Error Handling

- **Telegram API rate limit:** grammy auto-retry with backoff
- **User hasn't started bot:** Log warning, skip notification
- **Invalid chat_id:** Log error, mark user notification as failed

## Testing

- Unit test: command response formatting
- Unit test: pending question state machine
- Integration test: webhook payload handling with mock grammy

## Open Issues

None yet.
