-- Create storage buckets
-- Note: This may need to be run via Supabase dashboard or management API
-- depending on your Supabase version

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('user-documents', 'user-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('application-screenshots', 'application-screenshots', false, 5242880, ARRAY['image/png']);

-- Storage RLS: users access only their own folder (userId prefix)
CREATE POLICY storage_user_select ON storage.objects FOR SELECT USING (
  bucket_id IN ('user-documents', 'application-screenshots')
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY storage_user_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('user-documents', 'application-screenshots')
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY storage_user_delete ON storage.objects FOR DELETE USING (
  bucket_id IN ('user-documents', 'application-screenshots')
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);
