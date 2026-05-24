
-- =========================================================================
-- TASK MANAGEMENT MODULE — multi-branch, full audit trail
-- =========================================================================

-- Helper: operational date in Asia/Jerusalem, with 05:00 cutoff
CREATE OR REPLACE FUNCTION public.operational_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ((now() AT TIME ZONE 'Asia/Jerusalem') - INTERVAL '5 hours')::date
$$;

-- =========================================================================
-- SHIFTS
-- =========================================================================
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_branch ON public.shifts(branch_id, sort_order);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can read shifts of own branch"
  ON public.shifts FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Super admins insert shifts"
  ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins update shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete shifts"
  ON public.shifts FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER set_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- TASK GROUPS
-- =========================================================================
CREATE TABLE public.task_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_groups_shift ON public.task_groups(shift_id, sort_order);
CREATE INDEX idx_task_groups_branch ON public.task_groups(branch_id);

ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can read task_groups of own branch"
  ON public.task_groups FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Super admins insert task_groups"
  ON public.task_groups FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins update task_groups"
  ON public.task_groups FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete task_groups"
  ON public.task_groups FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER set_task_groups_updated_at
  BEFORE UPDATE ON public.task_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- TASKS
-- =========================================================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  recipe_id text,
  prep_item_id uuid REFERENCES public.prep_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_group ON public.tasks(group_id, sort_order);
CREATE INDEX idx_tasks_branch ON public.tasks(branch_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can read tasks of own branch"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Super admins insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- DAILY TASK LOGS  (audit trail)
-- =========================================================================
CREATE TABLE public.daily_task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT public.operational_today(),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by text,
  completed_by_user_id uuid,
  comments text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_task_logs_comments_len CHECK (char_length(coalesce(comments,'')) <= 2000),
  CONSTRAINT daily_task_logs_unique UNIQUE (task_id, log_date)
);

CREATE INDEX idx_daily_task_logs_branch_date ON public.daily_task_logs(branch_id, log_date);
CREATE INDEX idx_daily_task_logs_task ON public.daily_task_logs(task_id);

ALTER TABLE public.daily_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read logs of own branch"
  ON public.daily_task_logs FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Authed insert logs of own branch"
  ON public.daily_task_logs FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Authed update logs of own branch"
  ON public.daily_task_logs FOR UPDATE TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  )
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins delete logs of own branch"
  ON public.daily_task_logs FOR DELETE TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE TRIGGER set_daily_task_logs_updated_at
  BEFORE UPDATE ON public.daily_task_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_task_logs;
