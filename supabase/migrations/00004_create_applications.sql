CREATE TYPE public.bk_application_status AS ENUM (
  'APPLYING', 'APPLIED', 'FAILED',
  'DOCUMENTS_REQUESTED', 'DOCUMENTS_SENT',
  'VIEWING_INVITED', 'VIEWING_SCHEDULED',
  'EXTERNAL_FORM_DETECTED', 'EXTERNAL_FORM_FILLING',
  'AWAITING_USER_INPUT', 'EXTERNAL_FORM_SENT',
  'CLOSED'
);

CREATE TABLE public.bk_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.bk_users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.bk_listings(id) ON DELETE CASCADE,
  status public.bk_application_status NOT NULL DEFAULT 'APPLYING',
  retry_count integer DEFAULT 0 NOT NULL,
  timeline jsonb DEFAULT '[]' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_bk_applications_user_status ON public.bk_applications(user_id, status);
CREATE INDEX idx_bk_applications_listing ON public.bk_applications(listing_id);

CREATE TRIGGER bk_applications_updated_at
  BEFORE UPDATE ON public.bk_applications
  FOR EACH ROW EXECUTE FUNCTION public.bk_update_updated_at();
