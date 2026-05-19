
-- Auto-promote pending invitations into user_roles when an invited user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_invite RECORD;
BEGIN
  v_email := lower(NEW.email);
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Super admins are seeded separately; still ensure a role row exists
  IF v_email IN ('dorbareket123@gmail.com', 'suntzov93@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, v_email, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT * INTO v_invite FROM public.invitations WHERE lower(email) = v_email LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, email, role)
    VALUES (NEW.id, v_email, v_invite.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_invitation ON auth.users;
CREATE TRIGGER on_auth_user_created_invitation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_invitation();

-- Backfill: any existing auth user with a pending invitation gets the role now
INSERT INTO public.user_roles (user_id, email, role)
SELECT u.id, lower(u.email), i.role
FROM auth.users u
JOIN public.invitations i ON lower(i.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.invitations i
USING auth.users u
WHERE lower(i.email) = lower(u.email);

-- Lock down EXECUTE on the SECURITY DEFINER helper
REVOKE EXECUTE ON FUNCTION public.handle_new_user_invitation() FROM anon, authenticated, PUBLIC;
