CREATE TABLE public.bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  awaiting_field text,
  awaiting_application_id uuid REFERENCES public.applications(id),
  awaiting_job_id text,
  expires_at timestamptz NOT NULL
);

-- Only one active bot_session per user at a time
CREATE UNIQUE INDEX idx_bot_sessions_user_active
  ON public.bot_sessions(user_id)
  WHERE awaiting_field IS NOT NULL;
