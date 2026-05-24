
-- Add archival flags to suppliers and invoices
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- New: supplier orders history
CREATE TABLE IF NOT EXISTS public.supplier_orders_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  order_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_orders_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read order history of own branch"
ON public.supplier_orders_history FOR SELECT TO authenticated
USING (
  current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins insert order history of own branch"
ON public.supplier_orders_history FOR INSERT TO authenticated
WITH CHECK (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins delete order history of own branch"
ON public.supplier_orders_history FOR DELETE TO authenticated
USING (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_history_branch_created
  ON public.supplier_orders_history(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_history_supplier
  ON public.supplier_orders_history(supplier_id, created_at DESC);

-- Storage bucket for supplier logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-logos','supplier-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read supplier logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'supplier-logos');

CREATE POLICY "Admins upload supplier logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-logos' AND current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins update supplier logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'supplier-logos' AND current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins delete supplier logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'supplier-logos' AND current_user_role() = 'admin'::app_role);
