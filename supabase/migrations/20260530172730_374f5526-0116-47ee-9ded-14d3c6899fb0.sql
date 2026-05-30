ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS expected_price numeric,
  ADD COLUMN IF NOT EXISTS min_stock_alert numeric;