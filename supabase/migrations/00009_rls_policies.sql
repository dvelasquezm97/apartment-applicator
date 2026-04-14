-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

-- Users table (uses id, not user_id)
CREATE POLICY users_select ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_insert ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_delete ON public.users FOR DELETE USING (auth.uid() = id);

-- Documents
CREATE POLICY documents_select ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY documents_update ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY documents_delete ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- Listings (shared: SELECT for all authenticated, mutations via service role only)
CREATE POLICY listings_select ON public.listings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Applications
CREATE POLICY applications_select ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY applications_insert ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY applications_update ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY applications_delete ON public.applications FOR DELETE USING (auth.uid() = user_id);

-- Messages (access via application ownership)
CREATE POLICY messages_select ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.applications WHERE applications.id = messages.application_id AND applications.user_id = auth.uid())
);
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.applications WHERE applications.id = messages.application_id AND applications.user_id = auth.uid())
);

-- Appointments (access via application ownership)
CREATE POLICY appointments_select ON public.appointments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.applications WHERE applications.id = appointments.application_id AND applications.user_id = auth.uid())
);

-- Pending questions (access via application ownership)
CREATE POLICY pending_questions_select ON public.pending_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.applications WHERE applications.id = pending_questions.application_id AND applications.user_id = auth.uid())
);

-- Bot sessions
CREATE POLICY bot_sessions_select ON public.bot_sessions FOR SELECT USING (auth.uid() = user_id);
