-- Dev seed: remove auth.users FK and insert dev user
-- This will be replaced with proper auth later

ALTER TABLE public.bk_users DROP CONSTRAINT IF EXISTS bk_users_id_fkey;

INSERT INTO public.bk_users (id, immoscout_email, immoscout_password_encrypted, profile, automation_paused)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'placeholder@example.com',
  '',
  '{}',
  false
);
