CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CV', 'INCOME_PROOF', 'COVER_LETTER', 'SCHUFA', 'OTHER')),
  filename text NOT NULL,
  storage_key text NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_documents_user ON public.documents(user_id);
