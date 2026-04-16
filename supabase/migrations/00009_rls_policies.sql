-- Enable RLS on all tables
ALTER TABLE public.bk_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_pending_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_bot_sessions ENABLE ROW LEVEL SECURITY;

-- Users table (uses id, not user_id)
CREATE POLICY bk_users_select ON public.bk_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY bk_users_insert ON public.bk_users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY bk_users_update ON public.bk_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY bk_users_delete ON public.bk_users FOR DELETE USING (auth.uid() = id);

-- Documents
CREATE POLICY bk_documents_select ON public.bk_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY bk_documents_insert ON public.bk_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY bk_documents_update ON public.bk_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY bk_documents_delete ON public.bk_documents FOR DELETE USING (auth.uid() = user_id);

-- Listings (shared: SELECT for all authenticated, mutations via service role only)
CREATE POLICY bk_listings_select ON public.bk_listings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Applications
CREATE POLICY bk_applications_select ON public.bk_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY bk_applications_insert ON public.bk_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY bk_applications_update ON public.bk_applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY bk_applications_delete ON public.bk_applications FOR DELETE USING (auth.uid() = user_id);

-- Messages (access via application ownership)
CREATE POLICY bk_messages_select ON public.bk_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bk_applications WHERE bk_applications.id = bk_messages.application_id AND bk_applications.user_id = auth.uid())
);
CREATE POLICY bk_messages_insert ON public.bk_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.bk_applications WHERE bk_applications.id = bk_messages.application_id AND bk_applications.user_id = auth.uid())
);

-- Appointments (access via application ownership)
CREATE POLICY bk_appointments_select ON public.bk_appointments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bk_applications WHERE bk_applications.id = bk_appointments.application_id AND bk_applications.user_id = auth.uid())
);

-- Pending questions (access via application ownership)
CREATE POLICY bk_pending_questions_select ON public.bk_pending_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bk_applications WHERE bk_applications.id = bk_pending_questions.application_id AND bk_applications.user_id = auth.uid())
);

-- Bot sessions
CREATE POLICY bk_bot_sessions_select ON public.bk_bot_sessions FOR SELECT USING (auth.uid() = user_id);
