
-- 1) Enum for departments
DO $$ BEGIN
  CREATE TYPE public.staff_department AS ENUM ('kitchen','counter','delivery','management');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Add profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department public.staff_department,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 3) Allow management to update other profiles (current_user_role()='admin' covers super_admin + shift_manager)
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role)
  WITH CHECK (public.current_user_role() = 'admin'::public.app_role);

-- 4) Employee directory function — privacy-safe (address hidden from non-managers)
CREATE OR REPLACE FUNCTION public.list_employee_directory()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  department public.staff_department,
  seniority text,
  phone text,
  address text,
  role public.app_role,
  assigned_branch_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT public.current_user_branch_id() AS bid,
           public.current_user_role() AS r,
           public.is_super_admin(auth.uid()) AS sa
  ),
  ranked AS (
    SELECT ur.user_id, ur.role, ur.assigned_branch_id,
      ROW_NUMBER() OVER (
        PARTITION BY ur.user_id
        ORDER BY CASE ur.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'shift_manager' THEN 3
          WHEN 'viewer' THEN 4
          ELSE 5
        END
      ) AS rn
    FROM public.user_roles ur
    WHERE COALESCE(ur.is_active, true) = true
  )
  SELECT
    p.user_id,
    COALESCE(NULLIF(TRIM(p.full_name), ''), 'משתמש') AS full_name,
    p.department,
    p.seniority,
    p.phone,
    CASE WHEN (SELECT r FROM me) = 'admin'::public.app_role THEN p.address ELSE NULL END AS address,
    r.role,
    r.assigned_branch_id
  FROM ranked r
  JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.rn = 1
    AND auth.uid() IS NOT NULL
    AND ((SELECT sa FROM me) OR r.assigned_branch_id = (SELECT bid FROM me))
  ORDER BY full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.list_employee_directory() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_employee_directory() TO authenticated;

-- 5) Expand group mention tag → user_ids (scoped to caller's branch)
CREATE OR REPLACE FUNCTION public.list_users_in_group(_group text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT public.current_user_branch_id() AS bid,
           public.is_super_admin(auth.uid()) AS sa
  ),
  ranked AS (
    SELECT ur.user_id, ur.role, ur.assigned_branch_id,
      ROW_NUMBER() OVER (
        PARTITION BY ur.user_id
        ORDER BY CASE ur.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'shift_manager' THEN 3
          ELSE 4
        END
      ) AS rn
    FROM public.user_roles ur
    WHERE COALESCE(ur.is_active, true) = true
  )
  SELECT DISTINCT r.user_id
  FROM ranked r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.rn = 1
    AND auth.uid() IS NOT NULL
    AND ((SELECT sa FROM me) OR r.assigned_branch_id = (SELECT bid FROM me))
    AND CASE _group
      WHEN 'all'        THEN true
      WHEN 'kitchen'    THEN p.department = 'kitchen'::public.staff_department
      WHEN 'counter'    THEN p.department = 'counter'::public.staff_department
      WHEN 'delivery'   THEN p.department = 'delivery'::public.staff_department
      WHEN 'management' THEN (
        p.department = 'management'::public.staff_department
        OR r.role IN ('super_admin'::public.app_role, 'admin'::public.app_role, 'shift_manager'::public.app_role)
      )
      ELSE false
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_users_in_group(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_users_in_group(text) TO authenticated;
