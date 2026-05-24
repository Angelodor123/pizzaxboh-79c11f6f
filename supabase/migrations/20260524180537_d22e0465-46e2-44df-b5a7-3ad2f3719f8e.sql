-- 1. Add logo_url to suppliers for mini-logo display
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Invoice status enum
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('pending_review', 'approved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number text NOT NULL DEFAULT '',
  total_amount numeric NOT NULL DEFAULT 0,
  document_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date,
  image_url text,
  status public.invoice_status NOT NULL DEFAULT 'pending_review',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read invoices of own branch"
ON public.invoices FOR SELECT TO authenticated
USING (
  current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins insert invoices of own branch"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins update invoices of own branch"
ON public.invoices FOR UPDATE TO authenticated
USING (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
)
WITH CHECK (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE POLICY "Admins delete invoices of own branch"
ON public.invoices FOR DELETE TO authenticated
USING (
  current_user_role() = 'admin'::app_role
  AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
);

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_invoices_branch_date ON public.invoices(branch_id, document_date DESC);
CREATE INDEX idx_invoices_supplier ON public.invoices(supplier_id);

-- 4. Invoice items table
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read invoice items of own branch"
ON public.invoice_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
      AND (is_super_admin(auth.uid()) OR i.branch_id = current_user_branch_id())
  )
);

CREATE POLICY "Admins insert invoice items of own branch"
ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND current_user_role() = 'admin'::app_role
      AND (is_super_admin(auth.uid()) OR i.branch_id = current_user_branch_id())
  )
);

CREATE POLICY "Admins update invoice items of own branch"
ON public.invoice_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND current_user_role() = 'admin'::app_role
      AND (is_super_admin(auth.uid()) OR i.branch_id = current_user_branch_id())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND current_user_role() = 'admin'::app_role
      AND (is_super_admin(auth.uid()) OR i.branch_id = current_user_branch_id())
  )
);

CREATE POLICY "Admins delete invoice items of own branch"
ON public.invoice_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND current_user_role() = 'admin'::app_role
      AND (is_super_admin(auth.uid()) OR i.branch_id = current_user_branch_id())
  )
);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- 5. Storage bucket for invoice images
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-images', 'invoice-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view invoice images"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-images');

CREATE POLICY "Admins can upload invoice images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-images' AND current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins can update invoice images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoice-images' AND current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins can delete invoice images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-images' AND current_user_role() = 'admin'::app_role);
