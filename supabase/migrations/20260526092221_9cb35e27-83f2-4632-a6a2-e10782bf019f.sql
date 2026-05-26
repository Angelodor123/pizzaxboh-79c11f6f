ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS parsing_instructions text,
  ADD COLUMN IF NOT EXISTS last_raw_ocr jsonb;

CREATE TABLE IF NOT EXISTS public.invoice_ocr_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL,
  raw_ocr jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_ocr_feedback_supplier
  ON public.invoice_ocr_feedback(supplier_id, created_at DESC);

ALTER TABLE public.invoice_ocr_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ocr feedback of own branch"
  ON public.invoice_ocr_feedback FOR SELECT TO authenticated
  USING ((current_user_role() = 'admin'::app_role)
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins insert ocr feedback of own branch"
  ON public.invoice_ocr_feedback FOR INSERT TO authenticated
  WITH CHECK ((current_user_role() = 'admin'::app_role)
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));