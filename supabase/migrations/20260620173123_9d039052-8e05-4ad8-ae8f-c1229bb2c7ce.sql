-- Fix invoice-images branch isolation on write policies
DROP POLICY IF EXISTS "Admins can upload invoice images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update invoice images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete invoice images" ON storage.objects;

CREATE POLICY "Admins can upload invoice images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-images'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

CREATE POLICY "Admins can update invoice images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'invoice-images'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  )
  WITH CHECK (
    bucket_id = 'invoice-images'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

CREATE POLICY "Admins can delete invoice images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoice-images'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

-- Fix ticket-attachment deletes with branch isolation
DROP POLICY IF EXISTS "Admins delete ticket attachments" ON storage.objects;

CREATE POLICY "Admins delete ticket attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND public.current_user_role() = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.maintenance_tickets mt
      WHERE mt.photo_url LIKE ('%' || objects.name)
        AND mt.branch_id = public.current_user_branch_id()
    )
  );

-- Fix shift-feed update WITH CHECK to match folder restriction
DROP POLICY IF EXISTS "shift-feed author update" ON storage.objects;

CREATE POLICY "shift-feed author update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shift-feed'
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND EXISTS (
      SELECT 1 FROM public.shift_feed sf
      WHERE sf.image_url LIKE ('%' || objects.name)
        AND sf.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'shift-feed'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );