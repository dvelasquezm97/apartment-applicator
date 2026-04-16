CREATE TABLE public.bk_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.bk_users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CV', 'INCOME_PROOF', 'COVER_LETTER', 'SCHUFA', 'OTHER')),
  filename text NOT NULL,
  storage_key text NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_bk_documents_user ON public.bk_documents(user_id);
