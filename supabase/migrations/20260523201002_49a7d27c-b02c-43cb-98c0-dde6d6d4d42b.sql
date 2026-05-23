
-- 1) Branches table
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can read branches" ON public.branches
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));

CREATE POLICY "Super admins insert branches" ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins update branches" ON public.branches
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete branches" ON public.branches
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Seed default branch
INSERT INTO public.branches (name) VALUES ('סניף מודיעין');

-- Capture seed id for backfill
DO $$
DECLARE
  v_branch_id uuid;
BEGIN
  SELECT id INTO v_branch_id FROM public.branches WHERE name = 'סניף מודיעין';

  -- 3) Add assigned_branch_id to user_roles
  ALTER TABLE public.user_roles ADD COLUMN assigned_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
  UPDATE public.user_roles SET assigned_branch_id = v_branch_id;

  -- 4) Add branch_id to operational tables and backfill
  ALTER TABLE public.recipes ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.recipes SET branch_id = v_branch_id;
  ALTER TABLE public.recipes ALTER COLUMN branch_id SET NOT NULL;

  ALTER TABLE public.prep_items ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.prep_items SET branch_id = v_branch_id;
  ALTER TABLE public.prep_items ALTER COLUMN branch_id SET NOT NULL;

  ALTER TABLE public.restock_items ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.restock_items SET branch_id = v_branch_id;
  ALTER TABLE public.restock_items ALTER COLUMN branch_id SET NOT NULL;

  ALTER TABLE public.suppliers ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.suppliers SET branch_id = v_branch_id;
  ALTER TABLE public.suppliers ALTER COLUMN branch_id SET NOT NULL;

  ALTER TABLE public.calendar_events ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.calendar_events SET branch_id = v_branch_id;
  ALTER TABLE public.calendar_events ALTER COLUMN branch_id SET NOT NULL;

  ALTER TABLE public.notebook_items ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.notebook_items SET branch_id = v_branch_id;
  ALTER TABLE public.notebook_items ALTER COLUMN branch_id SET NOT NULL;

  ALTER TABLE public.ev_vehicles ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
  UPDATE public.ev_vehicles SET branch_id = v_branch_id;
  ALTER TABLE public.ev_vehicles ALTER COLUMN branch_id SET NOT NULL;
END $$;

CREATE INDEX idx_recipes_branch ON public.recipes(branch_id);
CREATE INDEX idx_prep_items_branch ON public.prep_items(branch_id);
CREATE INDEX idx_restock_items_branch ON public.restock_items(branch_id);
CREATE INDEX idx_suppliers_branch ON public.suppliers(branch_id);
CREATE INDEX idx_calendar_events_branch ON public.calendar_events(branch_id);
CREATE INDEX idx_notebook_items_branch ON public.notebook_items(branch_id);
CREATE INDEX idx_ev_vehicles_branch ON public.ev_vehicles(branch_id);
CREATE INDEX idx_user_roles_branch ON public.user_roles(assigned_branch_id);

-- 5) Helper: current user's branch
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_branch_id FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_branch_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id() TO authenticated;
