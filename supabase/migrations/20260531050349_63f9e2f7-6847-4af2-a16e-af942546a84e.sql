ALTER TABLE public.customer_complaints
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_branch_created
ON public.customer_complaints (branch_id, created_at DESC);