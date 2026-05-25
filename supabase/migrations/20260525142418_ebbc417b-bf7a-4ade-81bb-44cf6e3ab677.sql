
-- 1. Make super_admin be treated as admin in role checks
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
        AND role = 'super_admin'::public.app_role
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

-- 2. Dedupe directory listing — one row per user (super_admin > admin > viewer)
CREATE OR REPLACE FUNCTION public.list_user_directory()
 RETURNS TABLE(kind text, row_id uuid, user_id uuid, email text, full_name text, role app_role, assigned_branch_id uuid, is_active boolean, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT ur.*,
      ROW_NUMBER() OVER (
        PARTITION BY ur.user_id
        ORDER BY CASE ur.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'viewer' THEN 3
          ELSE 4
        END
      ) AS rn
    FROM public.user_roles ur
  )
  SELECT
    'user'::text AS kind,
    r.id AS row_id,
    r.user_id,
    r.email,
    p.full_name,
    r.role,
    r.assigned_branch_id,
    COALESCE(r.is_active, true) AS is_active,
    CASE WHEN COALESCE(r.is_active, true) THEN 'active' ELSE 'suspended' END AS status,
    r.created_at
  FROM ranked r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.rn = 1
    AND public.is_super_admin(auth.uid())
  UNION ALL
  SELECT
    'invite'::text AS kind,
    inv.id AS row_id,
    NULL::uuid AS user_id,
    inv.email,
    inv.full_name,
    inv.role,
    inv.assigned_branch_id,
    true AS is_active,
    'invited'::text AS status,
    inv.created_at
  FROM public.invitations inv
  WHERE public.is_super_admin(auth.uid())
$function$;

-- 3. Cleanup: Dor, Yishai, Omer keep only super_admin. Drop their extra admin rows.
DELETE FROM public.user_roles
WHERE role <> 'super_admin'::public.app_role
  AND LOWER(email) IN ('dorbareket123@gmail.com', 'yishai.kofman1@gmail.com', 'omersimon12@gmail.com');

-- For everyone else: ensure no super_admin (none today), and de-duplicate keeping highest-rank role only
WITH ranked AS (
  SELECT id, user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'viewer' THEN 3
        ELSE 4
      END
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
