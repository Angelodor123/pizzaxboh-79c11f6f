-- Fix shift-feed overlapping INSERT policies
DROP POLICY IF EXISTS "shift-feed admin insert" ON storage.objects;

CREATE POLICY "shift-feed admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shift-feed'
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Fix task photo uploads to include branch isolation via path prefix
DROP POLICY IF EXISTS "Authed upload task photos" ON storage.objects;

CREATE POLICY "Authed upload task photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-photos'
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

-- Fix task photo deletes to add branch isolation
DROP POLICY IF EXISTS "Admins delete task photos" ON storage.objects;

CREATE POLICY "Admins delete task photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-photos'
    AND public.current_user_role() = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.daily_task_logs l
      WHERE l.photo_url LIKE ('%' || objects.name)
        AND l.branch_id = public.current_user_branch_id()
    )
  );

-- Fix cibus receipts storage policies with branch isolation
DROP POLICY IF EXISTS "Cibus receipts admin read" ON storage.objects;
DROP POLICY IF EXISTS "Cibus receipts admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Cibus receipts admin update" ON storage.objects;
DROP POLICY IF EXISTS "Cibus receipts admin delete" ON storage.objects;

CREATE POLICY "Cibus receipts admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cibus_receipts'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

CREATE POLICY "Cibus receipts admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cibus_receipts'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

CREATE POLICY "Cibus receipts admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cibus_receipts'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  )
  WITH CHECK (
    bucket_id = 'cibus_receipts'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

CREATE POLICY "Cibus receipts admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cibus_receipts'
    AND public.current_user_role() = 'admin'::public.app_role
    AND (storage.foldername(name))[1] = public.current_user_branch_id()::text
  );

-- Fix emergency contacts to require active role (no branch_id on this table)
DROP POLICY IF EXISTS "Authenticated can read contacts" ON public.emergency_contacts;

CREATE POLICY "Authenticated can read contacts"
  ON public.emergency_contacts FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
  );

-- Fix current_user_branch_id to filter by active roles only
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT assigned_branch_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND COALESCE(is_active, true) = true
    AND role = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role, 'shift_manager'::public.app_role, 'super_admin'::public.app_role])
  ORDER BY created_at DESC
  LIMIT 1;
$$;