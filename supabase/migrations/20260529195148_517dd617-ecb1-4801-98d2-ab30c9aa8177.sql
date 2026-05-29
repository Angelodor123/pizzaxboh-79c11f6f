
CREATE TABLE public.supplier_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  name text NOT NULL,
  image_url text,
  unit text NOT NULL DEFAULT '',
  default_qty numeric NOT NULL DEFAULT 1,
  price numeric,
  barcode text,
  category text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_products_supplier ON public.supplier_products(supplier_id, sort_order);
CREATE INDEX idx_supplier_products_branch ON public.supplier_products(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read supplier products of own branch"
ON public.supplier_products FOR SELECT TO authenticated
USING (
  current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins insert supplier products of own branch"
ON public.supplier_products FOR INSERT TO authenticated
WITH CHECK (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins update supplier products of own branch"
ON public.supplier_products FOR UPDATE TO authenticated
USING (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
)
WITH CHECK (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins delete supplier products of own branch"
ON public.supplier_products FOR DELETE TO authenticated
USING (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE TRIGGER trg_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-product-images', 'supplier-product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read supplier product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'supplier-product-images');

CREATE POLICY "Authed upload supplier product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-product-images');

CREATE POLICY "Authed update supplier product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'supplier-product-images');

CREATE POLICY "Authed delete supplier product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'supplier-product-images');
