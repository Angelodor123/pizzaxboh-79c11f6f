ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branches_name_unique') THEN
    ALTER TABLE public.branches ADD CONSTRAINT branches_name_unique UNIQUE (name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND COALESCE(is_active, true) = true
        AND role IN ('super_admin'::public.app_role, 'shift_manager'::public.app_role)
    ) THEN 'admin'::public.app_role
    ELSE (
      SELECT role FROM public.user_roles
      WHERE user_id = auth.uid()
        AND COALESCE(is_active, true) = true
        AND role IN ('admin'::public.app_role, 'viewer'::public.app_role)
      ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'viewer' THEN 2 END
      LIMIT 1
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.network_dough_summary()
RETURNS TABLE(branch_id uuid, branch_name text, total_trays bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (d.branch_id, d.location)
      d.branch_id, d.location, d.trays_count
    FROM public.dough_updates_log d
    WHERE public.is_super_admin(auth.uid())
    ORDER BY d.branch_id, d.location, d.created_at DESC
  )
  SELECT
    b.id AS branch_id,
    b.name AS branch_name,
    COALESCE(SUM(l.trays_count), 0)::bigint AS total_trays
  FROM public.branches b
  LEFT JOIN latest l ON l.branch_id = b.id
  WHERE b.active = true AND public.is_super_admin(auth.uid())
  GROUP BY b.id, b.name
  ORDER BY b.name;
$function$;

REVOKE EXECUTE ON FUNCTION public.network_dough_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.network_dough_summary() TO authenticated;