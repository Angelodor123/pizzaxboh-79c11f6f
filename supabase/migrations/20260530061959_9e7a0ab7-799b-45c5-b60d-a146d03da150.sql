GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;