
CREATE TABLE public.dough_updates_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  prep_item_id uuid NOT NULL,
  trays_count integer NOT NULL,
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dough_updates_log_branch_created ON public.dough_updates_log (branch_id, created_at DESC);
CREATE INDEX idx_dough_updates_log_item_created ON public.dough_updates_log (prep_item_id, created_at DESC);

ALTER TABLE public.dough_updates_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read dough log of own branch"
ON public.dough_updates_log
FOR SELECT
TO authenticated
USING (
  (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Authed insert dough log of own branch"
ON public.dough_updates_log
FOR INSERT
TO authenticated
WITH CHECK (
  (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);
