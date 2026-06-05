
CREATE TABLE public.supplier_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  day_of_week smallint NULL CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6)),
  amount_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_standards_supplier_idx ON public.supplier_standards (supplier_id, branch_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_standards TO authenticated;
GRANT ALL ON public.supplier_standards TO service_role;

ALTER TABLE public.supplier_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch members read standards"
  ON public.supplier_standards FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id());

CREATE POLICY "Admins insert standards"
  ON public.supplier_standards FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins update standards"
  ON public.supplier_standards FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role)
  WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins delete standards"
  ON public.supplier_standards FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role);

CREATE TRIGGER set_updated_at_supplier_standards
  BEFORE UPDATE ON public.supplier_standards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS standards_callout text;
