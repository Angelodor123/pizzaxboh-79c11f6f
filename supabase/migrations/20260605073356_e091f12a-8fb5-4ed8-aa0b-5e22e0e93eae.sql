
-- ============================================================
-- Security fixes: branch isolation, role gates, and webhook auth
-- ============================================================

-- 1) cibus_wallets — restrict to admins (contains customer PII)
DROP POLICY IF EXISTS "Authenticated can view wallets" ON public.cibus_wallets;
DROP POLICY IF EXISTS "Authenticated can create wallets" ON public.cibus_wallets;
DROP POLICY IF EXISTS "Authenticated can update wallets" ON public.cibus_wallets;

CREATE POLICY "Admins view wallets" ON public.cibus_wallets
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role);
CREATE POLICY "Admins create wallets" ON public.cibus_wallets
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin'::public.app_role);
CREATE POLICY "Admins update wallets" ON public.cibus_wallets
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role)
  WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

-- 2) cibus_transactions_log — admin-only, prevent log tampering
DROP POLICY IF EXISTS "Authenticated can view tx log" ON public.cibus_transactions_log;
DROP POLICY IF EXISTS "Authenticated can insert tx log" ON public.cibus_transactions_log;
DROP POLICY IF EXISTS "Authenticated can update tx log" ON public.cibus_transactions_log;
DROP POLICY IF EXISTS "Authenticated can delete tx log" ON public.cibus_transactions_log;

CREATE POLICY "Admins view tx log" ON public.cibus_transactions_log
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role);
CREATE POLICY "Admins insert tx log" ON public.cibus_transactions_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (created_by IS NULL OR created_by = auth.uid())
  );
-- No UPDATE policy — financial log is immutable from clients.
-- Super admin DELETE policy already exists and remains in place.

-- 3) delivery_exceptions — branch isolation
DROP POLICY IF EXISTS "auth can view exceptions" ON public.delivery_exceptions;
DROP POLICY IF EXISTS "auth can insert exceptions" ON public.delivery_exceptions;
DROP POLICY IF EXISTS "auth can update exceptions" ON public.delivery_exceptions;

CREATE POLICY "view exceptions of own branch" ON public.delivery_exceptions
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id());
CREATE POLICY "insert exceptions of own branch" ON public.delivery_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id());
CREATE POLICY "update exceptions of own branch" ON public.delivery_exceptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  WITH CHECK (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id());

-- 4) notifications — block cross-user spam; allow self-insert; route others through SECURITY DEFINER RPC
DROP POLICY IF EXISTS "authenticated can create notifications" ON public.notifications;

CREATE POLICY "users create own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.create_notifications_for_users(
  _user_ids uuid[],
  _type text,
  _title text,
  _body text,
  _link text,
  _data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Allow if every target is the caller, OR caller is admin (admin/shift_manager/super_admin)
  IF NOT (
    public.current_user_role() = 'admin'::public.app_role
    OR (SELECT COALESCE(bool_and(uid = auth.uid()), false) FROM unnest(_user_ids) AS uid)
  ) THEN
    RAISE EXCEPTION 'Only admins can notify other users';
  END IF;

  FOREACH _uid IN ARRAY _user_ids LOOP
    INSERT INTO public.notifications (user_id, created_by, type, title, body, link, data)
    VALUES (_uid, auth.uid(), COALESCE(_type, 'info'), _title, _body, _link, COALESCE(_data, '{}'::jsonb));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, text, jsonb) TO authenticated;

-- 5) profiles — admins can only update profiles of users in their branch
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;

CREATE POLICY "Admins update same-branch profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = profiles.user_id
          AND ur.assigned_branch_id = public.current_user_branch_id()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = profiles.user_id
          AND ur.assigned_branch_id = public.current_user_branch_id()
      )
    )
  );

-- 6) recipe_versions — branch-scoped write policies
DROP POLICY IF EXISTS "Admins can insert versions" ON public.recipe_versions;
DROP POLICY IF EXISTS "Admins can delete versions" ON public.recipe_versions;

CREATE POLICY "Admins insert versions of own branch" ON public.recipe_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_versions.recipe_id
        AND (public.is_super_admin(auth.uid()) OR r.branch_id = public.current_user_branch_id())
    )
  );

CREATE POLICY "Admins delete versions of own branch" ON public.recipe_versions
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_versions.recipe_id
        AND (public.is_super_admin(auth.uid()) OR r.branch_id = public.current_user_branch_id())
    )
  );

-- 7) recipes — branch-scoped SELECT
DROP POLICY IF EXISTS "Authenticated users with role can read recipes" ON public.recipes;

CREATE POLICY "Users read recipes of own branch" ON public.recipes
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

-- 8) shift_feed — branch-scoped SELECT
DROP POLICY IF EXISTS "authenticated read shift feed" ON public.shift_feed;

CREATE POLICY "users read shift feed of own branch" ON public.shift_feed
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id());

-- 9) suppliers — branch-scoped SELECT
DROP POLICY IF EXISTS "Authenticated with role can read suppliers" ON public.suppliers;

CREATE POLICY "Users read suppliers of own branch" ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

-- 10) Dough alert webhook — shared secret used by route and Postgres trigger
INSERT INTO public.app_settings (key, value)
VALUES ('dough_alert_webhook_secret', jsonb_build_object('value', encode(extensions.gen_random_bytes(32), 'hex')))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_dough_threshold()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_threshold int;
  v_setting jsonb;
  v_secret text;
  v_hook_url text;
BEGIN
  IF NEW.location IS DISTINCT FROM 'shop' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'dough_alert_threshold';
  v_threshold := COALESCE((v_setting->>'value')::int, 15);

  SELECT (value->>'value') INTO v_secret FROM public.app_settings WHERE key = 'dough_alert_webhook_secret';

  IF NEW.trays_count < v_threshold THEN
    v_hook_url := 'https://project--0e28faf3-94b6-4399-9ba2-e9d1ba3d3774.lovable.app/api/public/hooks/dough-alert';
    BEGIN
      PERFORM extensions.net.http_post(
        url := v_hook_url,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-webhook-secret', COALESCE(v_secret,'')
        ),
        body := jsonb_build_object(
          'trays_count', NEW.trays_count,
          'threshold', v_threshold,
          'branch_id', NEW.branch_id,
          'updated_by_name', NEW.updated_by_name
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;
