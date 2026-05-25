REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.list_super_admin_user_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_super_admin_user_ids() TO postgres, service_role;