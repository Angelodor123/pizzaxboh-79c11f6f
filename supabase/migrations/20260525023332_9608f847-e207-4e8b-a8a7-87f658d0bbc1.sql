
-- 1. Update triggers to no longer auto-grant suntzov93 super_admin on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_invite RECORD;
  v_full_name text;
BEGIN
  v_email := lower(NEW.email);

  SELECT * INTO v_invite FROM public.invitations WHERE lower(email) = v_email LIMIT 1;

  v_full_name := COALESCE(
    NULLIF(TRIM(v_invite.full_name), ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (user_id, full_name, has_accepted_nda)
  VALUES (NEW.id, v_full_name, false)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(NULLIF(TRIM(EXCLUDED.full_name), ''), public.profiles.full_name);

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_email = 'dorbareket123@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, v_email, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, v_email, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, v_invite.role, v_invite.assigned_branch_id)
    ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$function$;

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

  IF _email = 'dorbareket123@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, _email, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, _email, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT role INTO _role FROM public.invitations WHERE LOWER(email) = _email;

  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, _email, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Delete suntzov93 data
DELETE FROM public.user_roles WHERE lower(email) = 'suntzov93@gmail.com';
DELETE FROM public.invitations WHERE lower(email) = 'suntzov93@gmail.com';
DELETE FROM public.profiles WHERE user_id = 'e92c2e6a-fc37-42f9-821e-5ceb1e971c96';
DELETE FROM auth.users WHERE lower(email) = 'suntzov93@gmail.com';
