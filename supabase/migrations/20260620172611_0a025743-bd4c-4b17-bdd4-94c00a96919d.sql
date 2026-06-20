-- 1) Revoke EXECUTE on internal SECURITY DEFINER functions from authenticated
-- Keep current_user_role, has_role, is_super_admin for RLS policies
REVOKE EXECUTE ON FUNCTION public.create_notifications_for_users FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.daily_task_logs_reset FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_invitation FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_employee_directory FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_mentionable_users FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_user_directory FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_user_profiles FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_users_in_group FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_super_admin_user_ids FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.network_dough_summary FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notebook_daily_reset FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_dough_threshold FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rollover_daily_operations FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_recipe_version FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_supplier_calendar_events FROM authenticated;

-- 2) Fix supplier-product-images storage policies
DROP POLICY IF EXISTS "Authed upload supplier product images" ON storage.objects;
DROP POLICY IF EXISTS "Authed update supplier product images" ON storage.objects;
DROP POLICY IF EXISTS "Authed delete supplier product images" ON storage.objects;

CREATE POLICY "Admins upload supplier product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-product-images' AND public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update supplier product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'supplier-product-images' AND public.current_user_role() = 'admin'::public.app_role)
  WITH CHECK (bucket_id = 'supplier-product-images' AND public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete supplier product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-product-images' AND public.current_user_role() = 'admin'::public.app_role);

-- 3) Fix shift-feed storage policies - add branch isolation
DROP POLICY IF EXISTS "shift-feed auth read" ON storage.objects;
DROP POLICY IF EXISTS "shift-feed auth insert" ON storage.objects;
DROP POLICY IF EXISTS "shift-feed auth update" ON storage.objects;
DROP POLICY IF EXISTS "shift-feed auth delete" ON storage.objects;
DROP POLICY IF EXISTS "shift-feed auth read" ON storage.objects;

CREATE POLICY "shift-feed admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shift-feed'
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
  );

CREATE POLICY "shift-feed own branch read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shift-feed'
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.shift_feed sf
        WHERE sf.image_url LIKE ('%' || objects.name)
          AND sf.branch_id = public.current_user_branch_id()
      )
    )
  );

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
  WITH CHECK (bucket_id = 'shift-feed');

CREATE POLICY "shift-feed author or admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shift-feed'
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.shift_feed sf
        WHERE sf.image_url LIKE ('%' || objects.name)
          AND (
            sf.user_id = auth.uid()
            OR (
              public.current_user_role() = 'admin'::public.app_role
              AND sf.branch_id = public.current_user_branch_id()
            )
          )
      )
    )
  );

-- 4) Fix customer_complaints policies - add branch check on insert and update
DROP POLICY IF EXISTS "Authenticated can create complaints" ON public.customer_complaints;
DROP POLICY IF EXISTS "Super admin or creator can view" ON public.customer_complaints;
DROP POLICY IF EXISTS "Super admin can update complaints" ON public.customer_complaints;
DROP POLICY IF EXISTS "Super admin can delete complaints" ON public.customer_complaints;

CREATE POLICY "Authenticated can create complaints for own branch"
  ON public.customer_complaints FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND branch_id = public.current_user_branch_id()
  );

CREATE POLICY "Super admin or creator can view complaints"
  ON public.customer_complaints FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR created_by = auth.uid()
    OR (
      public.current_user_role() = 'admin'::public.app_role
      AND branch_id = public.current_user_branch_id()
    )
  );

CREATE POLICY "Super admin or branch admin can update complaints"
  ON public.customer_complaints FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.current_user_role() = 'admin'::public.app_role
      AND branch_id = public.current_user_branch_id()
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      public.current_user_role() = 'admin'::public.app_role
      AND branch_id = public.current_user_branch_id()
    )
  );

CREATE POLICY "Super admin can delete complaints"
  ON public.customer_complaints FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 5) Add branch_id to cibus_wallets and cibus_transactions_log
ALTER TABLE public.cibus_wallets ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.cibus_transactions_log ADD COLUMN IF NOT EXISTS branch_id UUID;

-- Populate branch_id for existing records from creator's user_roles assignment
UPDATE public.cibus_wallets w
SET branch_id = ur.assigned_branch_id
FROM public.user_roles ur
WHERE w.created_by = ur.user_id
  AND w.branch_id IS NULL;

UPDATE public.cibus_transactions_log t
SET branch_id = ur.assigned_branch_id
FROM public.user_roles ur
WHERE t.created_by = ur.user_id
  AND t.branch_id IS NULL;

-- Update cibus policies with branch isolation
DROP POLICY IF EXISTS "Admins view wallets" ON public.cibus_wallets;
DROP POLICY IF EXISTS "Admins create wallets" ON public.cibus_wallets;
DROP POLICY IF EXISTS "Admins update wallets" ON public.cibus_wallets;
DROP POLICY IF EXISTS "Super admin can delete wallets" ON public.cibus_wallets;

CREATE POLICY "Admins view own branch wallets"
  ON public.cibus_wallets FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR branch_id = public.current_user_branch_id()
    )
  );

CREATE POLICY "Admins create wallets for own branch"
  ON public.cibus_wallets FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND branch_id = public.current_user_branch_id()
  );

CREATE POLICY "Admins update own branch wallets"
  ON public.cibus_wallets FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR branch_id = public.current_user_branch_id()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR branch_id = public.current_user_branch_id()
    )
  );

CREATE POLICY "Super admin can delete wallets"
  ON public.cibus_wallets FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view tx log" ON public.cibus_transactions_log;
DROP POLICY IF EXISTS "Admins insert tx log" ON public.cibus_transactions_log;
DROP POLICY IF EXISTS "Super admin can delete tx log" ON public.cibus_transactions_log;

CREATE POLICY "Admins view own branch tx log"
  ON public.cibus_transactions_log FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR branch_id = public.current_user_branch_id()
    )
  );

CREATE POLICY "Admins insert tx log for own branch"
  ON public.cibus_transactions_log FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR branch_id = public.current_user_branch_id()
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY "Super admin can delete tx log"
  ON public.cibus_transactions_log FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6) Fix realtime policy for customer_complaints to add branch filtering
DROP POLICY IF EXISTS "realtime complaints policy" ON public.customer_complaints;

-- Enable realtime with branch filtering using a security definer helper
CREATE OR REPLACE FUNCTION public.can_access_complaint_branch(c_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_complaints cc
    WHERE cc.id = c_id
      AND (
        public.is_super_admin(auth.uid())
        OR cc.branch_id = public.current_user_branch_id()
      )
  );
$$;

-- Note: Realtime policies are separate from table RLS. 
-- The application should scope realtime subscriptions by branch_id in the topic filter.
-- This function is provided for use in backend edge functions or realtime checks.