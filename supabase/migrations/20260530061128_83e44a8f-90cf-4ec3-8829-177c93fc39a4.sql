
-- 1) invitations: scope branch-admin inserts to their own branch
DROP POLICY IF EXISTS "Admins insert viewer, super admins insert any" ON public.invitations;
CREATE POLICY "Admins insert viewer, super admins insert any"
ON public.invitations FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    current_user_role() = 'admin'::app_role
    AND role = 'viewer'::app_role
    AND assigned_branch_id IS NOT NULL
    AND assigned_branch_id = current_user_branch_id()
  )
);

-- 2) user_roles: scope branch-admin inserts to their own branch
DROP POLICY IF EXISTS "Admins insert viewer roles, super admins any" ON public.user_roles;
CREATE POLICY "Admins insert viewer roles, super admins any"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    current_user_role() = 'admin'::app_role
    AND role = 'viewer'::app_role
    AND user_id <> auth.uid()
    AND assigned_branch_id IS NOT NULL
    AND assigned_branch_id = current_user_branch_id()
  )
);

-- 3) invoice_ocr_feedback: add UPDATE & DELETE for branch admins
CREATE POLICY "Admins update ocr feedback of own branch"
ON public.invoice_ocr_feedback FOR UPDATE TO authenticated
USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())))
WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));

CREATE POLICY "Admins delete ocr feedback of own branch"
ON public.invoice_ocr_feedback FOR DELETE TO authenticated
USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));

-- 4) supplier_orders_history: add scoped UPDATE
CREATE POLICY "Admins update order history of own branch"
ON public.supplier_orders_history FOR UPDATE TO authenticated
USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())))
WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));

-- 5) task-photos storage: branch-scope reads via daily_task_logs join
DROP POLICY IF EXISTS "Authed read task photos" ON storage.objects;
CREATE POLICY "Authed read task photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-photos'::text
  AND current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.daily_task_logs l
      WHERE l.photo_url LIKE ('%' || storage.objects.name || '%')
        AND l.branch_id = current_user_branch_id()
    )
  )
);

-- 6) Revoke EXECUTE from anon/authenticated for internal SECURITY DEFINER helpers
-- (keep current_user_role for app callers; keep list_* and network_dough_summary since app uses them)
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_branch_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
