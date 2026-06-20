
-- 1) Cibus receipts: restrict storage policies to admin role only
DROP POLICY IF EXISTS "Cibus receipts auth upload" ON storage.objects;
DROP POLICY IF EXISTS "Cibus receipts auth update" ON storage.objects;
DROP POLICY IF EXISTS "Cibus receipts auth delete" ON storage.objects;
DROP POLICY IF EXISTS "Cibus receipts authenticated read" ON storage.objects;

CREATE POLICY "Cibus receipts admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cibus_receipts' AND public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Cibus receipts admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cibus_receipts' AND public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Cibus receipts admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cibus_receipts' AND public.current_user_role() = 'admin'::public.app_role)
  WITH CHECK (bucket_id = 'cibus_receipts' AND public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Cibus receipts admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cibus_receipts' AND public.current_user_role() = 'admin'::public.app_role);

-- 2) delivery_exceptions: require an active app role on all policies
DROP POLICY IF EXISTS "view exceptions of own branch" ON public.delivery_exceptions;
DROP POLICY IF EXISTS "insert exceptions of own branch" ON public.delivery_exceptions;
DROP POLICY IF EXISTS "update exceptions of own branch" ON public.delivery_exceptions;

CREATE POLICY "view exceptions of own branch" ON public.delivery_exceptions
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "insert exceptions of own branch" ON public.delivery_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "update exceptions of own branch" ON public.delivery_exceptions
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  )
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

-- 3) supplier_standards: add branch isolation to write policies
DROP POLICY IF EXISTS "Admins insert standards" ON public.supplier_standards;
DROP POLICY IF EXISTS "Admins update standards" ON public.supplier_standards;
DROP POLICY IF EXISTS "Admins delete standards" ON public.supplier_standards;

CREATE POLICY "Admins insert standards" ON public.supplier_standards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins update standards" ON public.supplier_standards
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  )
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins delete standards" ON public.supplier_standards
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );
