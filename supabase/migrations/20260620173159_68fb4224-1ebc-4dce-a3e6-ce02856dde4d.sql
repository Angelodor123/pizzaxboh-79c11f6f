-- Drop overly broad supplier_standards SELECT policy
DROP POLICY IF EXISTS "Branch members read standards" ON public.supplier_standards;

-- Add admin-only policies for notebook_snapshots
DROP POLICY IF EXISTS "Branch members read notebook snapshots" ON public.notebook_snapshots;

CREATE POLICY "Branch members read notebook snapshots"
  ON public.notebook_snapshots FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins insert notebook snapshots"
  ON public.notebook_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins update notebook snapshots"
  ON public.notebook_snapshots FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  )
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins delete notebook snapshots"
  ON public.notebook_snapshots FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

-- Add admin-only policies for daily_operational_history
DROP POLICY IF EXISTS "Branch members read daily operational history" ON public.daily_operational_history;

CREATE POLICY "Branch members read daily operational history"
  ON public.daily_operational_history FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins insert daily operational history"
  ON public.daily_operational_history FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins update daily operational history"
  ON public.daily_operational_history FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  )
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

CREATE POLICY "Admins delete daily operational history"
  ON public.daily_operational_history FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );