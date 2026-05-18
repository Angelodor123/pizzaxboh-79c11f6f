-- app_settings
DROP POLICY IF EXISTS "Authed with role can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins delete settings" ON public.app_settings;

CREATE POLICY "Authed with role can read settings"
ON public.app_settings FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Admins insert settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role)
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete settings"
ON public.app_settings FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

-- calendar_event_overrides
DROP POLICY IF EXISTS "Authenticated with role can read overrides" ON public.calendar_event_overrides;
DROP POLICY IF EXISTS "Admins insert overrides" ON public.calendar_event_overrides;
DROP POLICY IF EXISTS "Admins update overrides" ON public.calendar_event_overrides;
DROP POLICY IF EXISTS "Admins delete overrides" ON public.calendar_event_overrides;

CREATE POLICY "Authenticated with role can read overrides"
ON public.calendar_event_overrides FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Admins insert overrides"
ON public.calendar_event_overrides FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update overrides"
ON public.calendar_event_overrides FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role)
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete overrides"
ON public.calendar_event_overrides FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

-- calendar_events
DROP POLICY IF EXISTS "Authenticated with role can read events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins insert events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins update events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins delete events" ON public.calendar_events;

CREATE POLICY "Authenticated with role can read events"
ON public.calendar_events FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Admins insert events"
ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update events"
ON public.calendar_events FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role)
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete events"
ON public.calendar_events FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

-- invitations
DROP POLICY IF EXISTS "Admins read invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins insert viewer, super admins insert any" ON public.invitations;

CREATE POLICY "Admins read invitations"
ON public.invitations FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete invitations"
ON public.invitations FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins insert viewer, super admins insert any"
ON public.invitations FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'admin'::public.app_role
  AND (role = 'viewer'::public.app_role OR public.is_super_admin(auth.uid()))
);

-- notebook_items
DROP POLICY IF EXISTS "Authenticated users with role can read notebook" ON public.notebook_items;
DROP POLICY IF EXISTS "Authenticated users with role can insert notebook" ON public.notebook_items;
DROP POLICY IF EXISTS "Authenticated users with role can update notebook" ON public.notebook_items;
DROP POLICY IF EXISTS "Authenticated users with role can delete notebook" ON public.notebook_items;

CREATE POLICY "Authenticated users with role can read notebook"
ON public.notebook_items FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Authenticated users with role can insert notebook"
ON public.notebook_items FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role)
  AND created_by = auth.uid()
);

CREATE POLICY "Authenticated users with role can update notebook"
ON public.notebook_items FOR UPDATE TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role))
WITH CHECK (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Authenticated users with role can delete notebook"
ON public.notebook_items FOR DELETE TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

-- recipe_versions
DROP POLICY IF EXISTS "Admins can view versions" ON public.recipe_versions;
DROP POLICY IF EXISTS "Admins can insert versions" ON public.recipe_versions;
DROP POLICY IF EXISTS "Admins can delete versions" ON public.recipe_versions;

CREATE POLICY "Admins can view versions"
ON public.recipe_versions FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins can insert versions"
ON public.recipe_versions FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins can delete versions"
ON public.recipe_versions FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

-- recipes
DROP POLICY IF EXISTS "Authenticated users with role can read recipes" ON public.recipes;
DROP POLICY IF EXISTS "Admins can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Admins can update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Admins can delete recipes" ON public.recipes;

CREATE POLICY "Authenticated users with role can read recipes"
ON public.recipes FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Admins can insert recipes"
ON public.recipes FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins can update recipes"
ON public.recipes FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role)
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins can delete recipes"
ON public.recipes FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

-- suppliers
DROP POLICY IF EXISTS "Authenticated with role can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins delete suppliers" ON public.suppliers;

CREATE POLICY "Authenticated with role can read suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Admins insert suppliers"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update suppliers"
ON public.suppliers FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role)
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete suppliers"
ON public.suppliers FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

-- user_roles
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins insert viewer roles, super admins any" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete non-admins, super admins any" ON public.user_roles;

CREATE POLICY "Admins view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins insert viewer roles, super admins any"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'admin'::public.app_role
  AND (role = 'viewer'::public.app_role OR public.is_super_admin(auth.uid()))
);

CREATE POLICY "Admins delete non-admins, super admins any"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (public.current_user_role() = 'admin'::public.app_role AND role = 'viewer'::public.app_role)
);