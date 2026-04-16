CREATE TABLE public.bk_bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.bk_users(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  awaiting_field text,
  awaiting_application_id uuid REFERENCES public.bk_applications(id),
  awaiting_job_id text,
  expires_at timestamptz NOT NULL
);

-- Only one active bot_session per user at a time
CREATE UNIQUE INDEX idx_bk_bot_sessions_user_active
  ON public.bk_bot_sessions(user_id)
  WHERE awaiting_field IS NOT NULL;
