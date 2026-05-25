-- is_super_admin: read from user_roles instead of hardcoded email list
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
      AND COALESCE(is_active, true) = true
  )
$$;

-- list_super_admin_user_ids: same source
CREATE OR REPLACE FUNCTION public.list_super_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'super_admin'::public.app_role
    AND COALESCE(is_active, true) = true
$$;

-- current_user_role: prefer admin over viewer (super_admin is orthogonal, granted as an extra row alongside admin)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
    AND COALESCE(is_active, true) = true
    AND role IN ('admin'::public.app_role, 'viewer'::public.app_role)
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'viewer' THEN 2 END
  LIMIT 1
$$;

-- Bootstrap trigger: also grant super_admin to the two original accounts on first signup
CREATE OR REPLACE FUNCTION public.handle_new_user_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_email IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com') THEN
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
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
  _role public.app_role;
BEGIN
  _email := LOWER(NEW.email);

  IF _email IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com') THEN
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
$$;

-- Lock down internal SECURITY DEFINER helpers per project memory
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_super_admin_user_ids() FROM anon, authenticated;
