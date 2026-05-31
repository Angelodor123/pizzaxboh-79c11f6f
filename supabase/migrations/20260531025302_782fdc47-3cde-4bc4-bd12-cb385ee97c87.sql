
-- Complaint status enum
CREATE TYPE public.complaint_status AS ENUM ('new', 'in_progress', 'resolved');

-- Customer complaints table
CREATE TABLE public.customer_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  address TEXT,
  description TEXT NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'new',
  manager_notes TEXT,
  compensation_notes TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_complaints TO authenticated;
GRANT ALL ON public.customer_complaints TO service_role;

ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;

-- All authenticated users may create complaints
CREATE POLICY "Authenticated can create complaints"
ON public.customer_complaints FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Creator can view own complaint (for confirmation), super admin sees all
CREATE POLICY "Super admin or creator can view"
ON public.customer_complaints FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR created_by = auth.uid());

-- Only super admin updates
CREATE POLICY "Super admin can update complaints"
ON public.customer_complaints FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Only super admin deletes
CREATE POLICY "Super admin can delete complaints"
ON public.customer_complaints FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_customer_complaints_updated_at
BEFORE UPDATE ON public.customer_complaints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_complaints_status_created ON public.customer_complaints(status, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_complaints;

-- Cibus wallets
CREATE TABLE public.cibus_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cibus_wallets TO authenticated;
GRANT ALL ON public.cibus_wallets TO service_role;

ALTER TABLE public.cibus_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view wallets"
ON public.cibus_wallets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create wallets"
ON public.cibus_wallets FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update wallets"
ON public.cibus_wallets FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Super admin can delete wallets"
ON public.cibus_wallets FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE INDEX idx_cibus_phone ON public.cibus_wallets(phone_number);
CREATE INDEX idx_cibus_name ON public.cibus_wallets(customer_name);
