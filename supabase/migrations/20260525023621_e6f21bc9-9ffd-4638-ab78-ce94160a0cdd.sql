
CREATE OR REPLACE FUNCTION public.list_super_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id FROM public.user_roles
  WHERE role = 'super_admin'::public.app_role
    AND COALESCE(is_active, true) = true
    AND public.is_super_admin(auth.uid())
$function$;

GRANT EXECUTE ON FUNCTION public.list_super_admin_user_ids() TO authenticated;
