
ALTER TABLE public.cibus_transactions_log
  ADD COLUMN IF NOT EXISTS receipt_image_url text;

-- Allow update/delete on transactions for authenticated users (needed for CRUD)
DROP POLICY IF EXISTS "Authenticated can update tx log" ON public.cibus_transactions_log;
CREATE POLICY "Authenticated can update tx log"
ON public.cibus_transactions_log
FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete tx log" ON public.cibus_transactions_log;
CREATE POLICY "Authenticated can delete tx log"
ON public.cibus_transactions_log
FOR DELETE TO authenticated
USING (true);

-- Storage bucket for receipt images (public so we can use public URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cibus_receipts', 'cibus_receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Cibus receipts public read" ON storage.objects;
CREATE POLICY "Cibus receipts public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'cibus_receipts');

DROP POLICY IF EXISTS "Cibus receipts auth upload" ON storage.objects;
CREATE POLICY "Cibus receipts auth upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cibus_receipts');

DROP POLICY IF EXISTS "Cibus receipts auth update" ON storage.objects;
CREATE POLICY "Cibus receipts auth update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cibus_receipts') WITH CHECK (bucket_id = 'cibus_receipts');

DROP POLICY IF EXISTS "Cibus receipts auth delete" ON storage.objects;
CREATE POLICY "Cibus receipts auth delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cibus_receipts');
