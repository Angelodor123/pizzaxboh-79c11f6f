CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles target_role
    WHERE target_role.user_id = _user_id
      AND target_role.role = 'super_admin'::public.app_role
      AND COALESCE(target_role.is_active, true) = true
      AND (
        _user_id = auth.uid()
        OR auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1
          FROM public.user_roles caller_role
          WHERE caller_role.user_id = auth.uid()
            AND caller_role.role = 'super_admin'::public.app_role
            AND COALESCE(caller_role.is_active, true) = true
        )
      )
  )
$function$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO postgres;