
DROP POLICY IF EXISTS "Cibus receipts public read" ON storage.objects;

CREATE POLICY "Cibus receipts authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cibus_receipts');
