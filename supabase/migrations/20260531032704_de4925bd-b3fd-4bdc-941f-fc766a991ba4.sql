
CREATE TABLE public.cibus_transactions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.cibus_wallets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('add','deduct','initial')),
  balance_after NUMERIC NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cibus_tx_wallet ON public.cibus_transactions_log(wallet_id, created_at DESC);

GRANT SELECT, INSERT ON public.cibus_transactions_log TO authenticated;
GRANT ALL ON public.cibus_transactions_log TO service_role;

ALTER TABLE public.cibus_transactions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tx log"
ON public.cibus_transactions_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert tx log"
ON public.cibus_transactions_log FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Super admin can delete tx log"
ON public.cibus_transactions_log FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.cibus_transactions_log;
