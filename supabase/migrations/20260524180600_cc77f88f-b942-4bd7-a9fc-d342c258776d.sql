-- Make invoice bucket private (use signed URLs in code)
UPDATE storage.buckets SET public = false WHERE id = 'invoice-images';

-- Replace public SELECT with authenticated-with-role only
DROP POLICY IF EXISTS "Public can view invoice images" ON storage.objects;

CREATE POLICY "Authed with role can view invoice images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'invoice-images'
  AND current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
);
