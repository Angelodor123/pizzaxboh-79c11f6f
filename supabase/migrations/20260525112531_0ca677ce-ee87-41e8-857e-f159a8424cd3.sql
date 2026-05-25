-- Super admins can read any profile
CREATE POLICY "Super admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admins can update any profile (including their own and other super admins)
CREATE POLICY "Super admins update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
