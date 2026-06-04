
CREATE OR REPLACE FUNCTION public.list_mentionable_users()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, COALESCE(NULLIF(TRIM(p.full_name), ''), 'משתמש') AS full_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE COALESCE(ur.is_active, true) = true
    AND auth.uid() IS NOT NULL
  ORDER BY full_name
$$;

REVOKE EXECUTE ON FUNCTION public.list_mentionable_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_mentionable_users() TO authenticated;
