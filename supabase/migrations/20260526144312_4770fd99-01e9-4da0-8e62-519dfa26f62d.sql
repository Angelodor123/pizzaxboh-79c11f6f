
UPDATE storage.buckets SET public = false WHERE id = 'task-photos';

DROP POLICY IF EXISTS "Public read task photos" ON storage.objects;
CREATE POLICY "Authed read task photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'task-photos' AND (public.current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])));
