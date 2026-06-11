
DROP POLICY IF EXISTS "shift-feed auth read" ON storage.objects;
CREATE POLICY "shift-feed auth read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'shift-feed');

DROP POLICY IF EXISTS "shift-feed auth upload own folder" ON storage.objects;
CREATE POLICY "shift-feed auth upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shift-feed'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "shift-feed auth delete own" ON storage.objects;
CREATE POLICY "shift-feed auth delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'shift-feed'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
