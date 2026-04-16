-- Users table (extends Supabase Auth)
CREATE TABLE public.bk_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id bigint,
  immoscout_email text NOT NULL,
  immoscout_password_encrypted text NOT NULL,
  immoscout_cookies_encrypted text,
  profile jsonb DEFAULT '{}' NOT NULL,
  daily_application_count integer DEFAULT 0 NOT NULL,
  daily_application_reset_at timestamptz,
  automation_paused boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.bk_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bk_users_updated_at
  BEFORE UPDATE ON public.bk_users
  FOR EACH ROW EXECUTE FUNCTION public.bk_update_updated_at();
