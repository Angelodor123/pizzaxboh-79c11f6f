
-- =========================
-- PART 3: Profile fields
-- =========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS start_date date;

-- =========================
-- PART 2: 30-day operational history
-- =========================
CREATE TABLE IF NOT EXISTS public.daily_operational_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid,
  snapshot_date date NOT NULL,
  kind text NOT NULL, -- 'tasks' | 'prep' | 'restock'
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, kind, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_doh_date ON public.daily_operational_history (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_doh_kind_date ON public.daily_operational_history (kind, snapshot_date DESC);

ALTER TABLE public.daily_operational_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authed read operational history of own branch" ON public.daily_operational_history;
CREATE POLICY "Authed read operational history of own branch"
ON public.daily_operational_history FOR SELECT TO authenticated
USING (
  (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR branch_id = current_user_branch_id())
);

-- =========================
-- PART 1+2: Rollover (snapshot + carry forward, no zero-reset)
-- =========================
CREATE OR REPLACE FUNCTION public.rollover_daily_operations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := public.operational_today();
  v_yest  date := v_today - INTERVAL '1 day';
  v_dow   int  := EXTRACT(DOW FROM v_today)::int; -- 0=Sun..6=Sat
BEGIN
  -- ---- Snapshot TASKS (per branch) ----
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    t.branch_id,
    v_yest,
    'tasks',
    COALESCE(jsonb_agg(jsonb_build_object(
      'task_id', t.id,
      'task_name', t.name,
      'group_id', t.group_id,
      'completed', COALESCE(l.completed, false),
      'completed_at', l.completed_at,
      'completed_by', l.completed_by,
      'comments', l.comments
    )), '[]'::jsonb)
  FROM public.tasks t
  LEFT JOIN public.daily_task_logs l
    ON l.task_id = t.id AND l.log_date = v_yest
  WHERE t.active = true
  GROUP BY t.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE
    SET payload = EXCLUDED.payload;

  -- ---- Snapshot PREP (global; prep_items has branch_id) ----
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    p.branch_id,
    v_yest,
    'prep',
    COALESCE(jsonb_agg(jsonb_build_object(
      'prep_item_id', p.id,
      'name', p.name,
      'unit', p.unit,
      'target', CASE EXTRACT(DOW FROM v_yest)::int
        WHEN 0 THEN p.target_sun WHEN 1 THEN p.target_mon WHEN 2 THEN p.target_tue
        WHEN 3 THEN p.target_wed WHEN 4 THEN p.target_thu WHEN 5 THEN p.target_fri
        WHEN 6 THEN p.target_sat END,
      'current_stock', COALESCE(pl.current_stock, 0),
      'completed', COALESCE(pl.completed, false)
    )), '[]'::jsonb)
  FROM public.prep_items p
  LEFT JOIN public.prep_log pl
    ON pl.prep_item_id = p.id AND pl.log_date = v_yest
  WHERE p.active = true
  GROUP BY p.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE
    SET payload = EXCLUDED.payload;

  -- ---- Snapshot RESTOCK ----
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    r.branch_id,
    v_yest,
    'restock',
    COALESCE(jsonb_agg(jsonb_build_object(
      'restock_item_id', r.id,
      'name', r.name,
      'unit', r.unit,
      'target', CASE EXTRACT(DOW FROM v_yest)::int
        WHEN 0 THEN r.target_sun WHEN 1 THEN r.target_mon WHEN 2 THEN r.target_tue
        WHEN 3 THEN r.target_wed WHEN 4 THEN r.target_thu WHEN 5 THEN r.target_fri
        WHEN 6 THEN r.target_sat END,
      'current_stock', COALESCE(rl.current_stock, 0),
      'completed', COALESCE(rl.completed, false)
    )), '[]'::jsonb)
  FROM public.restock_items r
  LEFT JOIN public.restock_log rl
    ON rl.restock_item_id = r.id AND rl.log_date = v_yest
  WHERE r.active = true
  GROUP BY r.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE
    SET payload = EXCLUDED.payload;

  -- ---- Carry forward PREP: items where current_stock < today's target ----
  INSERT INTO public.prep_log (prep_item_id, log_date, current_stock, completed)
  SELECT
    p.id,
    v_today,
    COALESCE(pl.current_stock, 0),
    false
  FROM public.prep_items p
  LEFT JOIN public.prep_log pl
    ON pl.prep_item_id = p.id AND pl.log_date = v_yest
  WHERE p.active = true
    AND COALESCE(pl.current_stock, 0) < CASE v_dow
        WHEN 0 THEN p.target_sun WHEN 1 THEN p.target_mon WHEN 2 THEN p.target_tue
        WHEN 3 THEN p.target_wed WHEN 4 THEN p.target_thu WHEN 5 THEN p.target_fri
        WHEN 6 THEN p.target_sat END
  ON CONFLICT DO NOTHING;

  -- ---- Carry forward RESTOCK: items where current_stock < today's target ----
  INSERT INTO public.restock_log (restock_item_id, log_date, current_stock, completed)
  SELECT
    r.id,
    v_today,
    COALESCE(rl.current_stock, 0),
    false
  FROM public.restock_items r
  LEFT JOIN public.restock_log rl
    ON rl.restock_item_id = r.id AND rl.log_date = v_yest
  WHERE r.active = true
    AND COALESCE(rl.current_stock, 0) < CASE v_dow
        WHEN 0 THEN r.target_sun WHEN 1 THEN r.target_mon WHEN 2 THEN r.target_tue
        WHEN 3 THEN r.target_wed WHEN 4 THEN r.target_thu WHEN 5 THEN r.target_fri
        WHEN 6 THEN r.target_sat END
  ON CONFLICT DO NOTHING;

  -- ---- Carry forward TASKS: uncompleted logs are re-opened today ----
  INSERT INTO public.daily_task_logs (task_id, branch_id, log_date, completed)
  SELECT t.id, t.branch_id, v_today, false
  FROM public.tasks t
  LEFT JOIN public.daily_task_logs l_old
    ON l_old.task_id = t.id AND l_old.log_date = v_yest AND l_old.completed = true
  WHERE t.active = true
    AND l_old.id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_task_logs l_today
      WHERE l_today.task_id = t.id AND l_today.log_date = v_today
    )
  ON CONFLICT DO NOTHING;

  -- ---- Purge old daily logs (> 30 days, history table preserves them) ----
  DELETE FROM public.daily_task_logs WHERE log_date < v_today - INTERVAL '30 days';
  DELETE FROM public.prep_log        WHERE log_date < v_today - INTERVAL '30 days';
  DELETE FROM public.restock_log     WHERE log_date < v_today - INTERVAL '30 days';

  -- ---- Purge history older than 30 days ----
  DELETE FROM public.daily_operational_history
  WHERE snapshot_date < v_today - INTERVAL '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rollover_daily_operations() FROM PUBLIC, anon, authenticated;

-- Replace the prior daily reset job with the new rollover job (05:05 IL = 03:05 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-task-logs-reset');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('rollover-daily-operations');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'rollover-daily-operations',
  '5 3 * * *',
  $$SELECT public.rollover_daily_operations();$$
);

-- =========================
-- PART 4: Default branch on invitation acceptance
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Resolve default branch (first active branch — currently Modiin)
  SELECT id INTO v_default_branch FROM public.branches
  WHERE active = true ORDER BY created_at LIMIT 1;

  IF v_email = 'dorbareket123@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, 'admin'::public.app_role, v_default_branch)
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, 'super_admin'::public.app_role, v_default_branch)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  IF v_invite.id IS NOT NULL THEN
    v_branch := COALESCE(v_invite.assigned_branch_id, v_default_branch);
    INSERT INTO public.user_roles (user_id, email, role, assigned_branch_id)
    VALUES (NEW.id, v_email, v_invite.role, v_branch)
    ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;
