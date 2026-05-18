
-- 1. Super admin function (hardcoded boot admins)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND LOWER(email) IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com')
  )
$$;

-- 2. Lock down SECURITY DEFINER helpers (only internal/RLS use)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_recipe_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_supplier_calendar_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
-- current_user_role stays callable (used by the app via RPC)

-- 3. Invitations: only super admins can invite admins
DROP POLICY IF EXISTS "Admins manage invitations" ON public.invitations;

CREATE POLICY "Admins read invitations"
ON public.invitations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete invitations"
ON public.invitations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert viewer, super admins insert any"
ON public.invitations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND (role = 'viewer' OR public.is_super_admin(auth.uid()))
);

CREATE POLICY "Super admins update invitations"
ON public.invitations FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. User roles: only super admins can grant/modify the 'admin' role
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Admins insert viewer roles, super admins any"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND (role = 'viewer' OR public.is_super_admin(auth.uid()))
);

CREATE POLICY "Admins delete non-admins, super admins any"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'admin') AND role = 'viewer')
);

CREATE POLICY "Super admins update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. Shared notebook table (realtime)
CREATE TABLE public.notebook_items (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key text NOT NULL CHECK (list_key IN ('tasks','shopping','orders','warehouse')),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notebook_items_list ON public.notebook_items(list_key, sort_order);

ALTER TABLE public.notebook_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users with role can read notebook"
ON public.notebook_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Authenticated users with role can insert notebook"
ON public.notebook_items FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'))
  AND created_by = auth.uid()
);

CREATE POLICY "Authenticated users with role can update notebook"
ON public.notebook_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Authenticated users with role can delete notebook"
ON public.notebook_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

CREATE TRIGGER trg_notebook_items_updated_at
BEFORE UPDATE ON public.notebook_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notebook_items;
ALTER TABLE public.notebook_items REPLICA IDENTITY FULL;
