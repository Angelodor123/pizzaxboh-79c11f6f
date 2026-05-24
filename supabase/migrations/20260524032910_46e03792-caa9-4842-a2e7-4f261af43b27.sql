-- Add full_name to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- Backfill full_name for existing users from auth.users metadata
UPDATE public.profiles p
SET full_name = COALESCE(
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'name',
  split_part(u.email, '@', 1)
)
FROM auth.users u
WHERE u.id = p.user_id AND p.full_name IS NULL;

-- Ensure a profile row exists for every existing auth user (so we can read full_name)
INSERT INTO public.profiles (user_id, full_name, has_accepted_nda)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
       false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- Update handle_new_user_invitation to also create a profile row with full_name from metadata
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
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Always ensure a profile row exists
  INSERT INTO public.profiles (user_id, full_name, has_accepted_nda)
  VALUES (NEW.id, v_full_name, false)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_email IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, v_email, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT * INTO v_invite FROM public.invitations WHERE lower(email) = v_email LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, v_invite.role, v_invite.assigned_branch_id)
    ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Add assigned_branch_id to invitations so a branch can be pre-assigned at invite time
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS assigned_branch_id uuid;

-- Make sure profiles has a unique constraint on user_id (needed for ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- RPC: list profiles for admin (full_name lookup for user_roles)
CREATE OR REPLACE FUNCTION public.list_user_profiles()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  WHERE current_user_role() = 'admin'::app_role
$$;

REVOKE EXECUTE ON FUNCTION public.list_user_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_user_profiles() TO authenticated;