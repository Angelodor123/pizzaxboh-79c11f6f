
-- Add helper to identify super-admin user_ids without exposing emails to the client
CREATE OR REPLACE FUNCTION public.list_super_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users
  WHERE LOWER(email) IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com')
$$;

REVOKE ALL ON FUNCTION public.list_super_admin_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_super_admin_user_ids() TO authenticated;

-- Lock down SECURITY DEFINER helpers that should never be callable by the public API.
-- Triggers and cron jobs do not need EXECUTE grants to function.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_invitation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_recipe_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notebook_daily_reset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_supplier_calendar_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
