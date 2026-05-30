
ALTER TABLE public.notebook_items
  ADD COLUMN IF NOT EXISTS catalog_product_id uuid REFERENCES public.supplier_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_stock numeric,
  ADD COLUMN IF NOT EXISTS unit text;

CREATE INDEX IF NOT EXISTS idx_notebook_items_catalog_product
  ON public.notebook_items(catalog_product_id)
  WHERE catalog_product_id IS NOT NULL;
