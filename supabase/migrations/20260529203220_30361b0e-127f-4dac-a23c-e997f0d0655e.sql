ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS unit_size text;

CREATE INDEX IF NOT EXISTS idx_supplier_products_sku ON public.supplier_products(supplier_id, sku);