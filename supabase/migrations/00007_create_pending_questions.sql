CREATE TABLE public.bk_pending_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.bk_applications(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  asked_at timestamptz DEFAULT now() NOT NULL,
  answered_at timestamptz,
  answer text,
  timed_out_at timestamptz
);

CREATE INDEX idx_bk_pending_questions_unanswered
  ON public.bk_pending_questions(application_id)
  WHERE answered_at IS NULL AND timed_out_at IS NULL;
