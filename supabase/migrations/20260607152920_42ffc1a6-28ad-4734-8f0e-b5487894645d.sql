
-- Tighten EXECUTE on SECURITY DEFINER helpers.
-- Anon role should not be able to call any of these.
-- has_role is used only inside RLS policies (policy evaluation does not require
-- EXECUTE for the caller), so revoke from regular roles to satisfy linter.

REVOKE EXECUTE ON FUNCTION public.list_mentionable_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.network_dough_summary() FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
