
CREATE TABLE public.emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contacts"
  ON public.emergency_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage contacts insert"
  ON public.emergency_contacts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins manage contacts update"
  ON public.emergency_contacts FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role)
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role);

CREATE POLICY "Admins manage contacts delete"
  ON public.emergency_contacts FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role);

CREATE TRIGGER trg_emergency_contacts_updated_at
  BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
