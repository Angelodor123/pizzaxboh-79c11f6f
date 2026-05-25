
-- 1) Restrict user_roles INSERT: admin can insert viewer roles for OTHER users; super admins can do anything
DROP POLICY IF EXISTS "Admins insert viewer roles, super admins any" ON public.user_roles;
CREATE POLICY "Admins insert viewer roles, super admins any"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    current_user_role() = 'admin'::app_role
    AND role = 'viewer'::app_role
    AND user_id <> auth.uid()
  )
);

-- 2) Revoke EXECUTE from PUBLIC on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.daily_task_logs_reset() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_user_directory() FROM PUBLIC, anon;

-- 3) Drop broad public-listing policy on supplier-logos. Public bucket URLs still serve files directly.
DROP POLICY IF EXISTS "Public read supplier logos" ON storage.objects;
