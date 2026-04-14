CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  immoscout_id text UNIQUE NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  address text,
  rent numeric,
  size numeric,
  rooms numeric,
  discovered_at timestamptz DEFAULT now() NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'delisted'))
);

CREATE INDEX idx_listings_immoscout_id ON public.listings(immoscout_id);
CREATE INDEX idx_listings_status ON public.listings(status);
