
-- 1. invitations: restrict admin read to own branch
DROP POLICY IF EXISTS "Admins read invitations" ON public.invitations;
CREATE POLICY "Admins read invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR assigned_branch_id = current_user_branch_id())
  );

DROP POLICY IF EXISTS "Admins delete invitations" ON public.invitations;
CREATE POLICY "Admins delete invitations" ON public.invitations
  FOR DELETE TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR assigned_branch_id = current_user_branch_id())
  );

-- 2. user_roles: restrict admin read to own branch (super admins keep full view)
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view roles in own branch" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR assigned_branch_id = current_user_branch_id())
  );

-- 3. app_settings: writes restricted to super_admin only
DROP POLICY IF EXISTS "Admins insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins delete settings" ON public.app_settings;
CREATE POLICY "Super admins insert settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admins update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admins delete settings" ON public.app_settings
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- 4. calendar_events: restrict reads to own branch
DROP POLICY IF EXISTS "Authenticated with role can read events" ON public.calendar_events;
CREATE POLICY "Authed read events of own branch" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

-- 5. calendar_event_overrides: restrict reads to overrides whose parent event is in own branch
DROP POLICY IF EXISTS "Authenticated with role can read overrides" ON public.calendar_event_overrides;
CREATE POLICY "Authed read overrides of own branch" ON public.calendar_event_overrides
  FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.calendar_events e
      WHERE e.id = calendar_event_overrides.event_id
        AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
    )
  );

-- 6. recipe_versions: restrict reads to versions of recipes in own branch
DROP POLICY IF EXISTS "Admins can view versions" ON public.recipe_versions;
CREATE POLICY "Admins view recipe versions of own branch" ON public.recipe_versions
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_versions.recipe_id
        AND (is_super_admin(auth.uid()) OR r.branch_id = current_user_branch_id())
    )
  );

-- 7. invoice-images storage: restrict reads to images linked to invoices in own branch
DROP POLICY IF EXISTS "Authed with role can view invoice images" ON storage.objects;
CREATE POLICY "Authed view invoice images of own branch" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-images'
    AND current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE (i.invoice_image_url LIKE '%' || objects.name || '%'
               OR i.image_url LIKE '%' || objects.name || '%')
          AND i.branch_id = current_user_branch_id()
      )
    )
  );
