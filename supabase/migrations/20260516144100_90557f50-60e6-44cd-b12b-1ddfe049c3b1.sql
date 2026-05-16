
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email TEXT;
  _role public.app_role;
BEGIN
  _email := LOWER(NEW.email);

  IF _email IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com') THEN
    _role := 'admin';
  ELSE
    SELECT role INTO _role FROM public.invitations WHERE LOWER(email) = _email;
  END IF;

  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, _email, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Promote now if the user already signed in previously
INSERT INTO public.user_roles (user_id, email, role)
SELECT id, LOWER(email), 'admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'suntzov93@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
