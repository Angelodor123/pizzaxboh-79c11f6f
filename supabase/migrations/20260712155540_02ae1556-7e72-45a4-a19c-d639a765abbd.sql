
CREATE TABLE public.container_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  weight_grams integer NOT NULL,
  notes text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_weights TO authenticated;
GRANT ALL ON public.container_weights TO service_role;

ALTER TABLE public.container_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View weights for own branch or global"
  ON public.container_weights FOR SELECT
  TO authenticated
  USING (branch_id IS NULL OR branch_id = public.current_user_branch_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins insert weights"
  ON public.container_weights FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Admins update weights"
  ON public.container_weights FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Admins delete weights"
  ON public.container_weights FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER container_weights_set_updated_at
  BEFORE UPDATE ON public.container_weights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
