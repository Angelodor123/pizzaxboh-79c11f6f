DROP POLICY IF EXISTS "Authed with role can read texts" ON public.site_texts;
DROP POLICY IF EXISTS "Admins insert texts" ON public.site_texts;
DROP POLICY IF EXISTS "Admins update texts" ON public.site_texts;
DROP POLICY IF EXISTS "Admins delete texts" ON public.site_texts;

CREATE POLICY "Authed with role can read texts"
ON public.site_texts
FOR SELECT
TO authenticated
USING (public.current_user_role() IN ('admin'::public.app_role, 'viewer'::public.app_role));

CREATE POLICY "Admins insert texts"
ON public.site_texts
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update texts"
ON public.site_texts
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role)
WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete texts"
ON public.site_texts
FOR DELETE
TO authenticated
USING (public.current_user_role() = 'admin'::public.app_role);