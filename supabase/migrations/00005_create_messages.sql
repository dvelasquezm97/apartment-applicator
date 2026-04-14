CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  content text NOT NULL,
  received_at timestamptz NOT NULL,
  processed_at timestamptz
);

CREATE INDEX idx_messages_application ON public.messages(application_id);
CREATE INDEX idx_messages_unprocessed ON public.messages(application_id) WHERE processed_at IS NULL;
