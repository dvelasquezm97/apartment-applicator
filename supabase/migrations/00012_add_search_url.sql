-- Add search URL and onboarding fields to bk_users
ALTER TABLE public.bk_users ADD COLUMN IF NOT EXISTS search_url text;
ALTER TABLE public.bk_users ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false NOT NULL;
