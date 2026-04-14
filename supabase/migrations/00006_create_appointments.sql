CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  datetime timestamptz NOT NULL,
  address text,
  google_calendar_event_id text,
  calendar_added boolean DEFAULT false NOT NULL
);

CREATE INDEX idx_appointments_upcoming ON public.appointments(datetime)
  WHERE datetime > now();
