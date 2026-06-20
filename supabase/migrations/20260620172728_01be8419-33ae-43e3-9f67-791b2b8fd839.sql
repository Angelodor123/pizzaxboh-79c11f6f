-- Remove unnecessary SECURITY DEFINER helper that is not actively used
REVOKE ALL ON FUNCTION public.can_access_complaint_branch FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_complaint_branch FROM authenticated;
DROP FUNCTION IF EXISTS public.can_access_complaint_branch;

-- Ensure core RLS helper functions are accessible to authenticated but not public
-- (These are needed by RLS policies and should remain available to signed-in users)
REVOKE ALL ON FUNCTION public.current_user_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_branch_id FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;

REVOKE ALL ON FUNCTION public.has_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;