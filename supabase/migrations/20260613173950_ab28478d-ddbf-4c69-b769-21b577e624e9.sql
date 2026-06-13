ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';