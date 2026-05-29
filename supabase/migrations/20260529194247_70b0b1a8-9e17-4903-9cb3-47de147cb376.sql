-- Fix: handle_new_user_invitation must overwrite branchless row that handle_new_user inserted first
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
  v_default_branch uuid;
  v_branch uuid;
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

  SELECT id INTO v_default_branch FROM public.branches
  WHERE active = true ORDER BY created_at LIMIT 1;

  IF v_email = 'dorbareket123@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, 'admin'::public.app_role, v_default_branch)
    ON CONFLICT (user_id, role) DO UPDATE
      SET assigned_branch_id = COALESCE(EXCLUDED.assigned_branch_id, public.user_roles.assigned_branch_id);
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, 'super_admin'::public.app_role, v_default_branch)
    ON CONFLICT (user_id, role) DO UPDATE
      SET assigned_branch_id = COALESCE(EXCLUDED.assigned_branch_id, public.user_roles.assigned_branch_id);
    RETURN NEW;
  END IF;

  IF v_invite.id IS NOT NULL THEN
    v_branch := COALESCE(v_invite.assigned_branch_id, v_default_branch);
    -- Overwrite branchless row from handle_new_user with the invitation's branch
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, v_invite.role, v_branch)
    ON CONFLICT (user_id, role) DO UPDATE
      SET assigned_branch_id = COALESCE(EXCLUDED.assigned_branch_id, public.user_roles.assigned_branch_id);
    DELETE FROM public.invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$function$;