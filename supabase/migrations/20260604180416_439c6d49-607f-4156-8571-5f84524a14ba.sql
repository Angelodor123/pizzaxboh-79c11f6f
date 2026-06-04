-- 1. Add cost_price column to supplier_products (backfill from expected_price)
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS cost_price numeric;

UPDATE public.supplier_products
SET cost_price = COALESCE(cost_price, expected_price, price)
WHERE cost_price IS NULL;

-- 2. mapping_corrections: every time a user manually re-maps a parsed
--    receipt item to a catalog product, we store the correction. The AI
--    matcher can later use this as training data per (supplier, parsed_text).
CREATE TABLE IF NOT EXISTS public.mapping_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  parsed_text text NOT NULL,
  corrected_product_id uuid REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  ai_suggested_product_id uuid REFERENCES public.supplier_products(id) ON DELETE SET NULL,
  ai_similarity numeric,
  match_action text NOT NULL DEFAULT 'remap',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapping_corrections TO authenticated;
GRANT ALL ON public.mapping_corrections TO service_role;

CREATE INDEX IF NOT EXISTS idx_mapping_corrections_supplier_text
  ON public.mapping_corrections (supplier_id, lower(parsed_text));
CREATE INDEX IF NOT EXISTS idx_mapping_corrections_branch
  ON public.mapping_corrections (branch_id, created_at DESC);

ALTER TABLE public.mapping_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read mapping corrections of own branch"
  ON public.mapping_corrections
  FOR SELECT
  TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins insert mapping corrections of own branch"
  ON public.mapping_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins update mapping corrections of own branch"
  ON public.mapping_corrections
  FOR UPDATE
  TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  )
  WITH CHECK (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins delete mapping corrections of own branch"
  ON public.mapping_corrections
  FOR DELETE
  TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );