
CREATE TABLE public.recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_versions_recipe ON public.recipe_versions(recipe_id, changed_at DESC);

ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view versions"
ON public.recipe_versions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert versions"
ON public.recipe_versions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete versions"
ON public.recipe_versions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.snapshot_recipe_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recipe_versions (recipe_id, snapshot, changed_by)
  VALUES (OLD.id, to_jsonb(OLD), auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER recipes_snapshot_before_update
BEFORE UPDATE ON public.recipes
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.snapshot_recipe_version();
