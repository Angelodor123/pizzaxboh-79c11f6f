CREATE TABLE public.delivery_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.supplier_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  expected_qty NUMERIC,
  actual_qty NUMERIC,
  reason TEXT NOT NULL CHECK (reason IN ('missing','damaged','unexpected_item','partial')),
  notes TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_exceptions TO authenticated;
GRANT ALL ON public.delivery_exceptions TO service_role;

ALTER TABLE public.delivery_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can view exceptions" ON public.delivery_exceptions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth can insert exceptions" ON public.delivery_exceptions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth can update exceptions" ON public.delivery_exceptions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "super admin can delete exceptions" ON public.delivery_exceptions
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE INDEX idx_delivery_exceptions_branch ON public.delivery_exceptions(branch_id);
CREATE INDEX idx_delivery_exceptions_supplier ON public.delivery_exceptions(supplier_id);
CREATE INDEX idx_delivery_exceptions_resolved ON public.delivery_exceptions(resolved);
CREATE INDEX idx_delivery_exceptions_created ON public.delivery_exceptions(created_at DESC);

CREATE TRIGGER trg_delivery_exceptions_updated_at
  BEFORE UPDATE ON public.delivery_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();