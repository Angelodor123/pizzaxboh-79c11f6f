-- 1. Add is_active flag to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Patch role helpers to ignore suspended rows
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
    AND COALESCE(is_active, true) = true
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'viewer' THEN 2 END
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND COALESCE(is_active, true) = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.current_user_branch_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT assigned_branch_id FROM public.user_roles
  WHERE user_id = auth.uid()
    AND COALESCE(is_active, true) = true
  LIMIT 1
$function$;

-- 3. Super Admin directory listing (registered + invited)
CREATE OR REPLACE FUNCTION public.list_user_directory()
 RETURNS TABLE(
   kind text,
   row_id uuid,
   user_id uuid,
   email text,
   full_name text,
   role app_role,
   assigned_branch_id uuid,
   is_active boolean,
   status text,
   created_at timestamptz
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    'user'::text AS kind,
    ur.id AS row_id,
    ur.user_id,
    ur.email,
    p.full_name,
    ur.role,
    ur.assigned_branch_id,
    COALESCE(ur.is_active, true) AS is_active,
    CASE WHEN COALESCE(ur.is_active, true) THEN 'active' ELSE 'suspended' END AS status,
    ur.created_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE public.is_super_admin(auth.uid())
  UNION ALL
  SELECT
    'invite'::text AS kind,
    inv.id AS row_id,
    NULL::uuid AS user_id,
    inv.email,
    inv.full_name,
    inv.role,
    inv.assigned_branch_id,
    true AS is_active,
    'invited'::text AS status,
    inv.created_at
  FROM public.invitations inv
  WHERE public.is_super_admin(auth.uid())
$function$;

REVOKE EXECUTE ON FUNCTION public.list_user_directory() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_directory() TO authenticated;
